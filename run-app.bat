@echo off
title Boulengerie - Application
cd /d "%~dp0"
echo ==================================================
echo    BOULENGERIE - Demarrage de l'application...
echo    Gardez cette fenetre OUVERTE pendant l'usage.
echo    Fermez-la pour arreter l'application.
echo ==================================================
echo.
call npm run dev -- --open
echo.
echo L'application s'est arretee.
pause
