@echo off
REM *** Replace the c:\code folder below to match your system's settings.
REM *** It is strongly recommended to use the folder structure as per documentation.
REM *** Otherwise, you will need to modify this file accordingly.
REM *** filename is required, without extension and no spaces.
cd c:\code
node .\Lib\KTL\NodeJS\NodeJS_ACB_MergeFiles.js -ktlpath=.\Lib\KTL -filename=.\Lib\KTL\KTL_KnackApp
