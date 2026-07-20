#!/bin/sh
exec zypak-wrapper.sh /app/jumble/jumble \
  --ozone-platform-hint=auto \
  --disable-features=FallbackToSWIfGLES3NotSupported \
  "$@"
