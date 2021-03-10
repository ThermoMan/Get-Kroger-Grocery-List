# Get-Kroger-Grocery-List
<br>Fetch your shopping trips from Kroger as a CSV per trip for import into Excel or other budget management software.

# To install this script
<br>1 Click the "Get Kroger Grocery List.user.js" link. 
<br>2 Click the button named "Raw".  If you have Greasemonkey installed it will take over from tehre and offer to install the script.

# The why of this script
<br>Kroger has made it difficult to use the other Puppeteer based tools to download your shopping history by detecting and rejecting the headless browser.  They provide no native tool to make life easier.

# Status
<br>This is a beta version of the export, but I wanted to get it out here so others could eyeball it and make suggestions.  Or heck, throw in some bug fixes. :D


Here is a sample data set

![image](https://user-images.githubusercontent.com/1949042/110583400-42440000-8133-11eb-939c-ffdab40db8c5.png)


On the list of #to do# is to split the QTY column up into a QTY and PRICE<br>
For intance "2 x $3.19/each" =>  QTY = 2, UNITS = "count", PRICE = $3.19

And "0.54 lbs x $8.98/each"  =>  QTY 0.54, UNITS = "lbs", PRICE = $8.98  (I'm writing in lbs because # has nearly stopped meaning pounds in modern usage - sad but true)
