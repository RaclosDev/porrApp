@REM Maven Wrapper script for Windows
@REM Auto-downloads Maven if not found

@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0
set MAVEN_CMD_LINE_ARGS=%*

set WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar"
set WRAPPER_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"

@REM Check if the wrapper jar exists, if not download it
if not exist %WRAPPER_JAR% (
    echo Downloading Maven Wrapper...
    powershell -Command "Invoke-WebRequest -Uri %WRAPPER_URL% -OutFile %WRAPPER_JAR%"
)

@REM Find java.exe
set JAVA_EXE=java.exe

@REM Fallback: try JAVA_HOME
if defined JAVA_HOME (
    set JAVA_EXE="%JAVA_HOME%\bin\java.exe"
)

@REM Try common Adoptium paths
if not exist %JAVA_EXE% (
    for /d %%i in ("C:\Program Files\Eclipse Adoptium\jdk-21*") do set JAVA_EXE="%%i\bin\java.exe"
)

%JAVA_EXE% -jar %WRAPPER_JAR% %MAVEN_CMD_LINE_ARGS%
