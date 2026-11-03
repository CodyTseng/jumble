import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const [command, ...args] = process.argv.slice(2)
const gradleTasks = { apk: ':app:assembleDebug', bundle: ':app:bundleRelease' }
const executable = (name) => (process.platform === 'win32' ? `${name}.exe` : name)

function isJdk21(home) {
  if (!home) return false
  try {
    const version = execFileSync(path.join(home, 'bin', executable('javac')), ['-version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return /^javac 21(?:\.|\s|$)/.test(version.trim())
  } catch {
    return false
  }
}

function commandOutput(binary, arguments_) {
  try {
    return execFileSync(binary, arguments_, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch {
    return undefined
  }
}

function findJdk21() {
  if (process.env.ANDROID_JAVA_HOME) {
    if (!isJdk21(process.env.ANDROID_JAVA_HOME)) {
      throw new Error('ANDROID_JAVA_HOME must point to a JDK 21 installation.')
    }
    return process.env.ANDROID_JAVA_HOME
  }
  if (isJdk21(process.env.JAVA_HOME)) return process.env.JAVA_HOME

  // Resolve the actual PATH Java home, which may differ from JAVA_HOME.
  const javaSettings = spawnSync('java', ['-XshowSettings:properties', '-version'], {
    encoding: 'utf8'
  })
  const pathJavaHome = javaSettings.stderr?.match(/^\s*java\.home\s*=\s*(.+)$/m)?.[1]?.trim()
  if (isJdk21(pathJavaHome)) return pathJavaHome

  const candidates =
    process.platform === 'darwin'
      ? [
          commandOutput('/usr/libexec/java_home', ['-v', '21']),
          '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
          '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
          '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
          path.join(os.homedir(), 'Applications/Android Studio.app/Contents/jbr/Contents/Home')
        ]
      : process.platform === 'win32'
        ? [path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Android/Android Studio/jbr')]
        : ['/opt/android-studio/jbr', '/usr/local/android-studio/jbr']
  const home = candidates.find(isJdk21)
  if (home) return home
  throw new Error(
    'JDK 21 was not found. Install JDK 21 or Android Studio with JBR 21, or set ANDROID_JAVA_HOME to your JDK 21 directory.'
  )
}

try {
  if (command !== 'run' && !Object.hasOwn(gradleTasks, command ?? '')) {
    throw new Error('Usage: node scripts/android.mjs <run|apk|bundle> [arguments]')
  }
  const javaHome = findJdk21()
  const env = { ...process.env, JAVA_HOME: javaHome }
  // Match Android Studio's default SDK location without changing the user's shell.
  if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT) {
    const sdk =
      process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library/Android/sdk')
        : process.platform === 'win32'
          ? path.join(
              process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData/Local'),
              'Android/Sdk'
            )
          : path.join(os.homedir(), 'Android/Sdk')
    if (existsSync(path.join(sdk, 'platform-tools'))) env.ANDROID_HOME = sdk
  }
  console.log(`[android] Using JDK 21: ${javaHome}`)
  const result =
    command === 'run'
      ? spawnSync(
          process.execPath,
          [
            path.join(projectRoot, 'node_modules/@capacitor/cli/bin/capacitor'),
            'run',
            'android',
            ...args
          ],
          {
            cwd: projectRoot,
            env,
            stdio: 'inherit'
          }
        )
      : // Invoke the checked-in wrapper with the selected Java, without a platform shell.
        spawnSync(
          path.join(javaHome, 'bin', executable('java')),
          [
            '-classpath',
            path.join(projectRoot, 'android/gradle/wrapper/gradle-wrapper.jar'),
            'org.gradle.wrapper.GradleWrapperMain',
            gradleTasks[command],
            ...args
          ],
          { cwd: path.join(projectRoot, 'android'), env, stdio: 'inherit' }
        )
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} catch (error) {
  console.error(`[android] ${error.message}`)
  process.exitCode = 1
}
