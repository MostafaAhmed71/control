param(
    [string]$SourceDirectory = (Join-Path $PSScriptRoot '..\إشعارت'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\notifications-ready')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await-Operation($Operation, $ResultType) {
    $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
if (-not $engine) { throw 'Windows English OCR language is unavailable.' }
$sourcePath = (Resolve-Path -LiteralPath $SourceDirectory).Path
$null = New-Item -ItemType Directory -Path $OutputDirectory -Force
$outputPath = (Resolve-Path -LiteralPath $OutputDirectory).Path
$files = @(Get-ChildItem -LiteralPath $sourcePath -File -Recurse | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' })
$report = @()
foreach ($file in $files) {
    $stream = $null
    try {
        $storage = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($file.FullName)) ([Windows.Storage.StorageFile])
        $stream = Await-Operation ($storage.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await-Operation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $result = Await-Operation ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        # IDs appear above the grades table. Do not infer IDs from names or page order.
        $headerText = ($result.Lines | Where-Object {
            $_.Words.Count -gt 0 -and $_.Words[0].BoundingRect.Y -lt ($bitmap.PixelHeight * 0.23)
        } | ForEach-Object { $_.Text }) -join ' '
        $ids = @([regex]::Matches($headerText, '(?<!\d)\d{8,10}(?!\d)') | ForEach-Object { $_.Value } | Select-Object -Unique)
        if ($ids.Count -eq 0) {
            # Retry only the printed identity field at higher resolution.
            $sourceImage = [System.Drawing.Bitmap]::new($file.FullName)
            $cropRect = [System.Drawing.Rectangle]::new([int]($sourceImage.Width * 0.45), [int]($sourceImage.Height * 0.19), [int]($sourceImage.Width * 0.22), [int]($sourceImage.Height * 0.025))
            $cropped = $sourceImage.Clone($cropRect, $sourceImage.PixelFormat)
            $scaled = [System.Drawing.Bitmap]::new($cropped, [int]($cropped.Width * 3), [int]($cropped.Height * 3))
            $tempImage = Join-Path ([System.IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString()) + '.png')
            $scaled.Save($tempImage, [System.Drawing.Imaging.ImageFormat]::Png)
            $scaled.Dispose(); $cropped.Dispose(); $sourceImage.Dispose()
            $cropStorage = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tempImage)) ([Windows.Storage.StorageFile])
            $cropStream = Await-Operation ($cropStorage.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
            try {
                $cropDecoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($cropStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
                $cropBitmap = Await-Operation ($cropDecoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
                $cropResult = Await-Operation ($engine.RecognizeAsync($cropBitmap)) ([Windows.Media.Ocr.OcrResult])
                $digits = $cropResult.Text -replace '\s', ''
                if ($digits -match '^\d{8,10}$') { $ids = @($digits) }
                $cropBitmap.Dispose()
            } finally { $cropStream.Dispose(); Remove-Item -LiteralPath $tempImage }
        }
        if ($ids.Count -ne 1) { throw "Expected one national ID in header, found $($ids.Count)." }
        $destination = Join-Path $outputPath ($ids[0] + $file.Extension.ToLowerInvariant())
        if (Test-Path -LiteralPath $destination) {
            if ((Get-FileHash -LiteralPath $destination).Hash -ne (Get-FileHash -LiteralPath $file.FullName).Hash) {
                throw 'Duplicate national ID with different images. Review manually.'
            }
        } else { Copy-Item -LiteralPath $file.FullName -Destination $destination }
        $report += [pscustomobject]@{ Source = $file.FullName; NationalId = $ids[0]; File = $destination; Status = 'ready'; Error = '' }
        $bitmap.Dispose()
    } catch {
        $report += [pscustomobject]@{ Source = $file.FullName; NationalId = ''; File = ''; Status = 'review'; Error = $_.Exception.Message }
    } finally { if ($stream) { $stream.Dispose() } }
    Write-Progress -Activity 'Preparing student notices' -Status "$($report.Count)/$($files.Count)" -PercentComplete ($report.Count * 100 / [Math]::Max(1, $files.Count))
}
$report | Export-Csv -LiteralPath (Join-Path $outputPath 'matching-report.csv') -NoTypeInformation -Encoding UTF8
Write-Output "Ready: $(@($report | Where-Object Status -eq 'ready').Count). Review: $(@($report | Where-Object Status -eq 'review').Count). Output: $outputPath"
