@echo off
cd /d "%~dp0.."
node scripts\pipeline.js >> logs\pipeline.log 2>&1
