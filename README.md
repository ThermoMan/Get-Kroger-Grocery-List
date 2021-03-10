# Get-Kroger-Grocery-List
<br>Fetch your shopping trips from Kroger as a CSV per trip for import into Excel or other budget management software.

# To install this script
<br>1 Click the "Get Kroger Grocery List.user.js" link. 
<br>2 Click the button named "Raw".  If you have Greasemonkey installed it will take over from tehre and offer to install the script.

If you ned to install GreaseMonkey first, click <a href="https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/">here</a> for the Mozilla Firefox Add-Ons "app store".

# The why of this script
<br>Kroger has made it difficult to use the other Puppeteer based tools to download your shopping history by detecting and rejecting the headless browser.  They provide no native tool to make life easier.

# Status
<br>This is a beta version of the export, but I wanted to get it out here so others could eyeball it and make suggestions.  Or heck, throw in some bug fixes. :D
<br>So far this is only tested on Firefox and Windows 10.  If you have a Mac and woudl like to contribute, or just identify issues, please do.  If you're using 

Here is a sample data set

![image](https://user-images.githubusercontent.com/1949042/110583400-42440000-8133-11eb-939c-ffdab40db8c5.png)

The extended price does not always match the unit price because it contains discounts and coupons which are not shown in the CSV file.  This shopping trip was in Texas where food has no tax anbd includes no non-food items so I don't have an example of that kind of data either.

On the list of #to do# is to split the QTY column up into a QTY and PRICE<br>
For intance "2 x $3.19/each" =>  QTY = 2, UNITS = "count", PRICE = $3.19

And "0.54 lbs x $8.98/each"  =>  QTY 0.54, UNITS = "lbs", PRICE = $8.98  (I'm writing in lbs because # has nearly stopped meaning pounds in modern usage - sad but true)
