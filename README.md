# Firefox-Manga-Local-Translation-Plugin
Plugin for firefox to translate JP KR manga using localy launched LLM.

Right now MWP (Minimal Workin Protorype) stage.

To use it:
1. download  tesseract-ocr data files (https://github.com/tesseract-ocr/tessdata) (Eng, Jp, KR), rename them in *.gz format , put in \tesseract\traineddata dir folder.
2. Launch local LLM in any network avaliable. (Tested with koboldcpp + Qwen 14b model).
3. Open about:debugging#/runtime/this-firefox in browser through "Load Temporary add-on" load add-on files.
4. In addon menu input local LLM IP and Port (check contection).
5. Open site with manga, select language, click start translate.
6. ..........
7. ..........
8. ........

   PROFIT!



   Thx to Grok, as he done coding after i formulated techincal assigment, thx to https://github.com/tesseract-ocr/ .

   Will see if i ever get time and wilingness to finis it.
