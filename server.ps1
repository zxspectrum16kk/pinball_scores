# Simple Static File Server for PowerShell
# Usage: ./server.ps1 [port]

param(
    [int]$port = 8000,
    [string]$Root = (Get-Location)
)

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "Server started at $prefix"
    Write-Host "Serving files from $Root"
    Write-Host "Press Ctrl+C to stop."
}
catch {
    Write-Error "Could not start server on port $port. Try a different port."
    exit 1
}

$mimeTypes = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    
    # Remove leading slash and convert to local path
    # Use $Root (provided or current directory) so the script can be stored anywhere
    $localPath = Join-Path $Root $path.TrimStart('/')

    if (Test-Path $localPath -PathType Leaf) {
        try {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $extension = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = $mimeTypes[$extension]
            if (-not $contentType) { $contentType = "application/octet-stream" }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.StatusCode = 200
        }
        catch {
            $response.StatusCode = 500
        }
    }
    else {
        $response.StatusCode = 404
    }

    $response.Close()
}
