@echo off
setlocal
cd /d "%~dp0"
for %%V in (3.12 3.11 3.10) do (
    py -%%V -c "import sys" >nul 2>nul
    if not errorlevel 1 (
        py -%%V bootstrap.py
        goto finished
    )
)
python -c "import sys; sys.exit(sys.version_info[:2] not in {(3, 10), (3, 11), (3, 12)})" >nul 2>nul
if not errorlevel 1 (
    python bootstrap.py
) else (
    echo Install Python 3.10, 3.11 or 3.12 and start again.
)
:finished
pause
