@echo off
cd /d "C:\Users\wtknt\Documents\tenstrage"
node scripts\extract-income-records.js >> logs\extract-income.log 2>&1
