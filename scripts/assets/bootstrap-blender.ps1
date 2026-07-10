[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$version = '3.6.23'
$archiveName = 'blender-3.6.23-windows-x64.zip'
$archiveUrl = 'https://download.blender.org/release/Blender3.6/blender-3.6.23-windows-x64.zip'
$fallbackArchiveUrl = 'https://mirror.freedif.org/blender/release/Blender3.6/blender-3.6.23-windows-x64.zip'
$expectedBytes = 388356346
$expectedSha256 = 'e3296eba7eab32c2e5182459ec7614af32224eee2bd32c9d0a08ffd751c54f3b'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$toolsRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot '.tools'))
$toolsPrefix = $toolsRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

function Resolve-ToolsChildPath {
    param([Parameter(Mandatory = $true)][string]$Candidate)

    $fullPath = [System.IO.Path]::GetFullPath($Candidate)
    if (-not $fullPath.StartsWith($toolsPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to use a path outside the worktree-local tools directory: $fullPath"
    }
    return $fullPath
}

$installRoot = Resolve-ToolsChildPath (Join-Path $toolsRoot "blender-$version-windows-x64")
$blenderExe = Join-Path $installRoot 'blender.exe'

if (Test-Path -LiteralPath $blenderExe) {
    $firstLine = (& $blenderExe --version | Select-Object -First 1)
    if ($firstLine -ne "Blender $version") {
        throw "Existing $blenderExe reported '$firstLine'; expected 'Blender $version'."
    }
    Write-Output $blenderExe
    exit 0
}

New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
$archivePath = Resolve-ToolsChildPath (Join-Path $toolsRoot $archiveName)
$extractRoot = Resolve-ToolsChildPath (Join-Path $toolsRoot ("blender-extract-" + [guid]::NewGuid().ToString('N')))

if (Test-Path -LiteralPath $installRoot) {
    throw "Incomplete Blender install already exists at $installRoot; inspect and remove it before retrying."
}

try {
    Invoke-WebRequest -UseBasicParsing -Uri $archiveUrl -OutFile $archivePath
} catch {
    Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
    Write-Warning "The pinned Blender host was unavailable; retrying the Blender-directed mirror."
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $fallbackArchiveUrl -OutFile $archivePath
    } catch {
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
        throw
    }
}

$actualBytes = (Get-Item -LiteralPath $archivePath).Length
if ($actualBytes -ne $expectedBytes) {
    Remove-Item -LiteralPath $archivePath -Force
    throw "Blender archive size mismatch: expected $expectedBytes bytes, got $actualBytes."
}

$actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
    Remove-Item -LiteralPath $archivePath -Force
    throw "Blender archive digest mismatch: expected $expectedSha256, got $actualSha256."
}

New-Item -ItemType Directory -Path $extractRoot | Out-Null
try {
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot
    $expandedRoot = Resolve-ToolsChildPath (Join-Path $extractRoot "blender-$version-windows-x64")
    if (-not (Test-Path -LiteralPath (Join-Path $expandedRoot 'blender.exe'))) {
        throw "The verified Blender archive did not contain the expected executable."
    }

    Move-Item -LiteralPath $expandedRoot -Destination $installRoot
} finally {
    if (Test-Path -LiteralPath $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
    Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
}

$firstLine = (& $blenderExe --version | Select-Object -First 1)
if ($firstLine -ne "Blender $version") {
    Remove-Item -LiteralPath $installRoot -Recurse -Force
    throw "Installed Blender reported '$firstLine'; expected 'Blender $version'."
}

Write-Output $blenderExe
