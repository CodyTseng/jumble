import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

// HTML for the YouTube IFrame API shim. The renderer loads this in an
// <iframe>; because the shim itself is served over http://, YouTube's IFrame
// API accepts the parent origin (otherwise it surfaces "player error 153"
// against non-http(s) origins like the app://renderer/ SPA).
//
// Message protocol:
//   parent → shim:  { source: 'yt-host', type: 'play'|'pause'|'stop'|'mute'|'unmute'|'destroy' }
//   shim → parent:  { source: 'yt-shim', type: 'ready' }
//                   { source: 'yt-shim', type: 'state', state: <YT.PlayerState> }
//                   { source: 'yt-shim', type: 'muted', muted: boolean }
//                   { source: 'yt-shim', type: 'error', code: number }
const YT_SHIM_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html,body{height:100%;width:100%;margin:0;background:#000;overflow:hidden}
    /* YT.Player replaces #yt with its own <iframe>; force it to fill the shim. */
    #yt,body>iframe{height:100%!important;width:100%!important;border:0;display:block}
  </style>
</head>
<body>
  <div id="yt"></div>
  <script>
  (function(){
    var q = new URLSearchParams(location.search);
    var videoId = q.get('videoId') || '';
    var mute = q.get('mute') === '1';
    var parentOrigin = q.get('parentOrigin') || '*';
    var player = null;
    var lastState = -1;
    var lastMuted = mute;
    function post(msg){ parent.postMessage(Object.assign({ source: 'yt-shim' }, msg), parentOrigin); }
    window.addEventListener('message', function(e){
      if (parentOrigin !== '*' && e.origin !== parentOrigin) return;
      var m = e.data;
      if (!m || m.source !== 'yt-host' || !player) return;
      try {
        switch (m.type) {
          case 'play': player.playVideo(); break;
          case 'pause': player.pauseVideo(); break;
          case 'stop': player.stopVideo(); break;
          case 'mute': player.mute(); break;
          case 'unmute': player.unMute(); break;
          case 'destroy': player.destroy(); break;
        }
      } catch (err) { /* ignore */ }
    });
    window.onYouTubeIframeAPIReady = function(){
      player = new YT.Player('yt', {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars: { mute: mute ? 1 : 0, playsinline: 1 },
        events: {
          onReady: function(){
            post({ type: 'ready' });
            setInterval(function(){
              if (!player || typeof player.isMuted !== 'function') return;
              try {
                var m = player.isMuted();
                if (m !== lastMuted) { lastMuted = m; post({ type: 'muted', muted: m }); }
              } catch (err) { /* ignore */ }
            }, 200);
          },
          onStateChange: function(ev){
            if (ev.data !== lastState) { lastState = ev.data; post({ type: 'state', state: ev.data }); }
          },
          onError: function(ev){ post({ type: 'error', code: ev && ev.data }); }
        }
      });
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  })();
  </script>
</body>
</html>`

// Hosts a tiny http://127.0.0.1 endpoint that returns the YouTube IFrame API
// shim page. The shim lives on http:// so YouTube's IFrame API accepts it as
// a parent origin — the main SPA itself is served over app:// for stable
// origin (account/IDB storage doesn't shift between launches).
//
// Binds to port 0: the OS hands out an unused port. The port can change every
// launch and that's fine — the shim is stateless and the renderer fetches the
// current origin via IPC on demand.
export class MediaServer {
  private server: Server | null = null
  private url: string | null = null
  private expectedHost: string | null = null

  start(): Promise<string> {
    if (this.url) return Promise.resolve(this.url)

    const server = createServer((req, res) => this.handle(req, res))

    return new Promise<string>((resolve, reject) => {
      const onError = (err: Error) => {
        server.removeListener('listening', onListening)
        reject(err)
      }
      const onListening = () => {
        server.removeListener('error', onError)
        const addr = server.address()
        if (!addr || typeof addr === 'string') {
          reject(new Error('media-server: failed to obtain bound address'))
          return
        }
        this.server = server
        this.url = `http://127.0.0.1:${addr.port}`
        this.expectedHost = `127.0.0.1:${addr.port}`
        server.on('error', (e) => console.error('[media-server]', e))
        resolve(this.url)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(0, '127.0.0.1')
    })
  }

  stop() {
    if (!this.server) return
    this.server.close()
    this.server = null
    this.url = null
    this.expectedHost = null
  }

  getUrl(): string | null {
    return this.url
  }

  private handle(req: IncomingMessage, res: ServerResponse) {
    // DNS-rebinding defense: reject any request whose Host header is not the
    // literal bound address. A page hosted on attacker.com that DNS-rebinds
    // to 127.0.0.1 still sends `Host: attacker.com:<port>`.
    if (req.headers.host !== this.expectedHost) {
      res.statusCode = 421
      res.end()
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end()
      return
    }

    const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (requestUrl.pathname !== '/yt-shim.html') {
      res.statusCode = 404
      res.end()
      return
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; object-src 'none'; " +
        "script-src 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; " +
        "style-src 'unsafe-inline'; img-src data: https:; media-src blob: https:; " +
        'connect-src https:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; ' +
        "form-action 'none'; frame-ancestors app://renderer"
    )

    if (req.method === 'HEAD') {
      res.statusCode = 200
      res.end()
      return
    }

    res.end(YT_SHIM_HTML)
  }
}
