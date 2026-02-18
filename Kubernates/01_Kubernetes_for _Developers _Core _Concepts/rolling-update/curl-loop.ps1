For ($i=0; $i -le 100; $i++) {
    $html = Invoke-WebRequest http://localhost:8080 -UseBasicParsing
    $html.Content -split "[`r`n]" | select-string "<title>.*</title>"
    Start-Sleep -s 2
}