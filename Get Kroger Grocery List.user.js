// ==UserScript==
// @name         Get Kroger Grocery List
// @namespace    PrettyDarnUseful
// @version      0.1
// @description  Get Kroger Grocery List
// @author       ThermoMan
// @match        https://www.kroger.com/mypurchases/detail/*
// @grant        none
// @run-at       document-end
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// ==/UserScript==

"use strict";
var debug = false;

var start = function( jQuery ){
  log( "Here is my start function" );
  addButton( "Get List" );
};


function buttonClickAction(){
  console.clear();
  log( "Trying to fetch the grocery shopping list." );
  // So the whitespace separates the "siblings" in text.
  var tripDate = $( "div[class='PurchaseCard_wrap-fields-outer py-0 px-16']" ).find( "span[class='kds-Text--m']" ).find( "br" ).get(0).nextSibling.nextSibling.nodeValue;

  log( "Date of purchase was: " + tripDate );

  var ii = 0;
  var saveString = "date, name, size, price, qty, ext_price\n";
  $( "div[class='PH-ProductCard-container w-full p-16']" ).each( function(){
    ii++;
    var productName = $(this).find( "a[class='kds-Link kds-Link--inherit']" ).text();
    log( "Product "+ii+" name was: " + productName );

    var productSize = $(this).find( "span[class='kds-Text--xs PH-ProductCard-item-description-size text-default-500 mb-4']" ).text();
    log( "Product "+ii+" size was: " + productSize );
// Later on separate units  "25.4 oz"   "30 fl oz"  "2.5 gal"   "6 ct / 3 oz"    "1 lb"

    var extendedPrice = $(this).find( "div[class='PH-ProductCard-Total flex flex-col items-start mb-8 lg:w-1/3']" )[0].firstChild.value;
    log( "Product "+ii+" extended price was: " + extendedPrice );

    var quantity = $(this).find( "span[class='kds-Text--s text-default-500 body-xs']" ).text();
    log( "Product "+ii+" quantity was: " + quantity );

    var unitPrice = $(this).find( "span[class='kds-Text--s text-default-500 body-xs']" ).find( "span" ).text();
    log( "Product "+ii+" unit price was: " + unitPrice );

    saveString = saveString + tripDate + "," + productName + "," + productSize + "," + unitPrice + "," + quantity + "," + extendedPrice  + "\n";
  });
  save( saveString, tripDate );
}


// This function injects CSS into the page
// Need to adapt this function to use jQuery
function addGlobalStyle( css ){
  var head;
  var style;
  head = document.getElementsByTagName( "head" )[0];
  // if( !head ){ return; }
  style = document.createElement( "style" );
  style.type = "text/css";
  style.innerHTML = css;
  head.appendChild( style );
}


// This function adds a button to the screen to trigger the script
// Need to adapt this function to use jQuery
function addButton( text ){
  // Add style
  var cssStr = "#rs_myContainer{ position: fixed; top: 121px; left: 7px; font-size: 20px; background-color: darkgray; border: 3px outset black; margin: 5px; opacity: 0.9; z-index: 1100; padding: 5px 20px; } #rs_myButton{ cursor: pointer; background-color: darkgray; }";
  addGlobalStyle( cssStr );

  // Add button
  var zNode = document.createElement( "div" );
  zNode.innerHTML = "<button id='rs_myButton' type='button'>"+text+"</button>";
  zNode.setAttribute( "id", "rs_myContainer" );
  document.body.appendChild( zNode );

  // Activate the newly added button.
  document.getElementById( "rs_myButton" ).addEventListener( "click", buttonClickAction, false );
}


// This function only writes to the console if debug is true.
function log( pMessage ){
  if( debug ){
    console.debug( pMessage );
  }
}

// This function always writes to the console
function save( pMessage, pDate ){
  console.log( pMessage );
	pDate = pDate.replaceAll( "/", "-" );			// Fix illegal file systrem charaters
	pMessage = pMessage.replaceAll( "®", "" );		// Fix dumb mark
	pMessage = pMessage.replaceAll( "’", "'" );	// Fis stupid single quotes

  // var container = document.querySelector( "textarea" );
  var anchor = document.querySelector( "a" );
  anchor.onclick = function(){
    anchor.href = "data:text/plain;charset=utf-8," + encodeURIComponent( pMessage );
    anchor.download = "export-"+pDate+".csv";
  }
  anchor.click();

}


// This function laods jQuery manually if for some reason the @require does not work.
function add_jQuery( callbackFn, jqVersion ){
  var jqVersion   = jqVersion || "1";
  var D           = document;
  var targ        = D.getElementsByTagName( "head" )[0] || D.body || D.documentElement;
  var scriptNode  = D.createElement( "script" );
  scriptNode.src  = "https://ajax.googleapis.com/ajax/libs/jquery/" + jqVersion + "/jquery.min.js";
  scriptNode.addEventListener( "load", function(){
    var innerNode          = D.createElement( "script" );
    innerNode.textContent  = "var gm_jQuery  = jQuery.noConflict( true );\n" + "(" + callbackFn.toString() + ")( gm_jQuery );";
    targ.appendChild( innerNode );
  }, false );
  targ.appendChild( scriptNode );
}


// Make sure that some version of jQuery is loaded before going on
if( typeof jQuery === "function" ){
  log( "Running with local copy of jQuery!" );
  start( jQuery );
}else{
  log( "Fetching jQuery from some 3rd-party server." );
  add_jQuery( start, "3.5.1" );
}
