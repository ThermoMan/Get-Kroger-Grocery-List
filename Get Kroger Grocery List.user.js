// ==UserScript==
// @name         Get Grocery Shopping History
// @namespace    PrettyDarnUseful
// @version      0.9
// @description  Get Grocery Shopping History
// @author       ThermoMan
// @match        https://www.(dillons|kroger).com/mypurchases/detail/*
// @run-at       document-end
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @require      https://code.jquery.com/ui/1.13.2/jquery-ui.min.js
// @resource     jqueryui_css https://ajax.googleapis.com/ajax/libs/jqueryui/1.13.2/themes/smoothness/jquery-ui.css
// @grant        none
// ==/UserScript==

/**
 ** TO DO LIST
 **
 ** File Format
 **   Instead of building a giant text field build a JSON object
 **     Add a checkbox to save as CSV or JSON?
 **   Excel is not recognizing the first column in the CSV file as a date, it thinks that it is text.
 **
 ** Data Source
 **   Test grocery delivery for data format.
 **   Either duplicate this script for Walmart or add a detection mode.
 **     Filename or data column should also indicate the store. (DONE)
 **     Will need to abstract the parsing function for stores not using Kroger's format
 **   Find and document new edge cases (WIP) of typos or qty/size swap in description (DONE).
 **
 ** Parsed Data
 **   Perhaps add the mode to the CSV file?  'in store', 'pickup', 'delivery', 'fuel station'
 **   Add store name in case someone shops at both Kroger and Dillons. (DONE)
 **   Perhaps add store address (or store #) to differentiate in case a product is only at one store, but not the other.
 **
 ** Inner Smarts
 **   Should I do something when the price shown in the QUANTITY column does not match the EXTENDED PRICE (for instance note the discount or the tax?)
 **     Fuel price actually has a message about discount in hidden text.
 **   Move the character translate into a list and just iterate through the list?
 **
 ** Refactor Code
 **   Conform to other data export code I've written. (DONE)
 **/

/**
 ** My reference notes
 **
 ** Fix Firefox warning of slow scripts https://support.mozilla.org/en-US/kb/warning-unresponsive-script
 **
 ** GreaseMonkey wiki https://wiki.greasespot.net/Main_Page
 ** GreaseMonkey docs http://greasemonkey.win-start.de/
 **
 **/

(function() {
  'use strict';
  var debug = true;

  // Log function for debugging
  function log( pMessage ){
    if( debug ){
      if( pMessage === 'clear' ){
        console.clear();
      }
      else{
        console.debug( pMessage );
      }
    }
  }


  function buttonClickAction(){
    log( 'buttonClickAction started' );

    // Show spinning notifier
    $( '#rs_fetch_button' ).prop( 'disabled', true ).addClass( 'disabled' );
    $( '#spinner2' ).css( 'visibility', 'visible' ).addClass( 'spinning' );

    var tripDate = "";
    var storeName = "";
    var rawSize = "";
    var left = "";
    var right = "";
    var packInfo = null;
    var sizeInfo = null;
    var packSuffix = "";
    var saveString = "";

    // Helper to detect and extract count/pack
    function extractCount( str ){
      const countMatch = str.match( /^(\d+(?:\.\d+)?)\s*(pk|ct|count|pack|rolls?|bottles?|cans?|ea|each)/i );
      if( countMatch ){
        return {
          count: parseInt( countMatch[1], 10 )
          ,unit: countMatch[2].toLowerCase().replace( /s$/, '' )  // normalize plural (remove trailing 's')
        };
      }
      return null;
    }

    // Helper to detect and extract size + units
    function extractSize( str ){
      const sizeMatch = str.match( /^([\d.]+)\s*([a-zA-Z\s]+)$/i );
      if( sizeMatch ){
        return {
            number: sizeMatch[1]
             ,unit: sizeMatch[2].trim()
        };
      }
      return null;
    }


    try{
      // Get trip date from URL (note that tripDate is a STRING not a Date object)
      tripDate = window.location.href.split( '~' )[2] || 'unknown-date';
      log( 'Date of purchase was: ' + tripDate );

      storeName = window.location.href.split( '.' )[1] || 'kroger';

      saveString = "STORE,DATE,MESSAGE,NAME,SIZE,UNITS,COUNT,UNIT_PRICE,QTY,EXT_PRICE\n";

      // Main container of purchased items list
      const $itemsList = $( 'ul[role="list"].list-none.m-0.pl-0.pb-4' );

      if( !$itemsList.length ){
        alert( "No item list found on this page.\nThe structure might have changed again." );
        throw new Error( "Main items list <ul> not found" );
      }

      // Decide once whether this is a fuel receipt (strongest signal)
      const isFuelReceipt = $( 'h2:contains("Fuel Items")' ).length > 0;

      $itemsList.find( '> li.mx-16.border-neutral-least-subtle' ).each( function(){
        const $li = $(this);

        var message = "Purchase";
        var productName = "";
        var sizeNumber = "";
        var unit = "";
        var packCount = "1";
        var packNum = 1;
        var qty = "1";
        var paidPriceClean = "";
        var unitPrice = "";
        var extended = "";

        if( isFuelReceipt ){
          message = "Fuel";

          productName = $li.find( 'h3.kds-Heading' ).first()
                         .text()
                         .trim()
                         .replace(/,/g, ' ')
                         .replace(/\s+/g, ' ') || "Kroger Fuel";

          const receivedText = $li.find( 'span.kds-Text--m:contains("Received:")' ).text().trim();

          if( receivedText.includes( 'Received:' ) ){
            const match = receivedText.match(/Received:\s*([\d.]+)\s*([a-zA-Z]+)/i);
            if( match ){
              sizeNumber = match[1];
              unit = match[2].toLowerCase().trim();
            }
          }
        }
        else{
          message = "Purchase";

          // Product name
          productName = $li.find( 'h3[data-testid="cart-page-item-description"]' ).text().trim();
//                                                                                  .replace( /,/g, ' ' )
//                                                                                  .replace( /\s+/g, ' ' );
          if( !productName ){
            alert( "No product name found on this page.\nThe structure might have changed again." );
            throw new Error( "Product name not found" );
          }



          // Size/weight parsing
          rawSize = $li.find( 'span[data-testid="product-item-sizing"]' ).text();
log( `1 - Initial ${productName} rawSize (((${rawSize})))` );
          if( !rawSize ){
            alert( "No size info found on this page.\nThe structure might have changed again." );
            throw new Error( "Size info not found" );
          }


/* Fix inconsistencies in labelling, edge cases and really stupid typos in Kroger data.

Kroger Text                  packNum size  unit  name suffix
"14.5 oz / 4 pk"             4      14.5  oz     (4 pk)
"24 bottles / 16.9 fl oz"   24      16.9  fl oz (24 pk)
"2 pk / 16 oz"               2      16    oz     (2 pk)
"24 ct / 6 lb"              24       6    lb    (24 pk)
"18 rolls"                   —      18    rolls
"11OZA"                      —      11    oz (flipping typo!)
"15 FO"                      —      15    fl oz (flipping typo!)
*/



          rawSize = rawSize.trim()
                           .replace( /OZA/i, 'oz' )            // Fix bad data
                           .replace( /\bFO\b/i, 'fl oz' )      // Fix bad data
                           .replace( /net wt /gi, '' )
                           .replace( /bag \/ /gi, '' )
                           .replace( /ounce/i, 'oz' )
                           .replace( /pound/i, 'lb' )
                           .replace( /\s+/g, ' ')
                           .toLowerCase();



//log( `2 - Fixed ${productName} rawSize (((${rawSize})))` );

          const slashParts = rawSize.split( /\s*\/\s*/ );

          if( slashParts.length === 2 ){
            left = slashParts[0].trim();
            right = slashParts[1].trim();
          }
          else{
            // No slash, so treat whole as size
            left = rawSize;
            right = "";
          }
log( `3 - For left ${left}` );
log( `3 - For right ${right}` );


          // Try to classify left & right
          // Case 1: left = pack/count, right = size (bottled water style)
          packInfo = extractCount( left );
          if( packInfo ){
log( `4 - For packInfo ${packInfo}` );
            sizeInfo = extractSize( right );
log( `4 - For sizeInfo ${sizeInfo}` );
          }

          // Case 2: left = size, right = pack/count (canned 4-pack tomatoes style)
          if( !packInfo ){
            sizeInfo = extractSize( left );
log( `5 - For sizeInfo ${sizeInfo}` );
            if( sizeInfo ){
              packInfo = extractCount( right );
log( `5 - For packInfo ${packInfo}` );
            }
          }

          // Case 3: no slash
          if( !packInfo && !sizeInfo ){
log( `6 - Neither` );
            if( slashParts.length === 1 ){
              sizeInfo = extractSize( rawSize );
log( `6 - For sizeInfo ${sizeInfo}` );
            }
          }

log( `7 - Final sizeInfo ${sizeInfo}` );
log( `7 - Final packInfo ${packInfo}` );


          // Assign final values
          if( packInfo && packInfo.count > 1 ){
            packNum = packInfo.count;
            packSuffix = ` (${packNum} pk)`;
log( `8 - For packNum ${packNum}` );
log( `8 - For packSuffix ${packSuffix}` );
          }

          if( sizeInfo ){
            sizeNumber = sizeInfo.number;
            unit = sizeInfo.unit;
log( `9 - For sizeNumber ${sizeNumber}` );
log( `9 - For unit ${unit}` );
          }
          else if( packInfo ){
            // Rare: only pack count, no size use count as sizeNumber
            sizeNumber = packInfo.count.toString();
            unit = "";
log( `A - For sizeNumber ${sizeNumber}` );
log( `A - For unit ${unit}` );
          }


log( `B - Final sizeNumber ${sizeNumber}` );
log( `B - Final unit ${unit}` );
log( `B - Final packNum ${packNum}` );
log( `B - Final packSuffix ${packSuffix}` );

        // Number of packages bought


        // Extract actual transaction total ("Paid:" section)
// This finds the first element and it's the wrong one!  Need the last one.
//        const $paidElement = $li.find( 'data.kds-Price' );
          const $paidElement = $li.find( 'data.kds-Price' ).last();
          if( $paidElement.length ){
            paidPriceClean = $paidElement.attr('value') || "";

            if( !paidPriceClean ){
              // If that didn't work, try again on another element.
              const aria = $paidElement.attr('aria-label') || "";
              const ariaMatch = aria.match(/\$?([\d.]+)/);
              if( ariaMatch ){
                paidPriceClean = ariaMatch[1];
              }
              else{
                paidPriceClean = "";
              }
            }

            if( !paidPriceClean ){
              // If is STILL didn't work, glue the price together from the display elements on the page.  This is really hacky.
              const html = $paidElement.html() || "";
              const parts = html.match(/<span class="kds-Price-promotional-dropCaps">(\d+)<\/span>.*?<sup[^>]*>(\d{2})/i);
              if( parts && parts.length === 3 ){
                paidPriceClean = parts[1] + '.' + parts[2];
              }
            }
          }
          paidPriceClean = paidPriceClean.replace( /[^0-9.]/g, '' );
        }
        // Final calculations
        const totalPaid = parseFloat( paidPriceClean ) || 0;
log( 'totalPaid = ' + totalPaid );
        const packCountNum = parseInt( packCount, 10 ) || 1;
        const packSizeNum = packNum || 1;
log( 'packCountNum = ' + packCountNum );
log( 'packSizeNum = ' + packSizeNum );
        const qtyNum = packCountNum * packSizeNum;
log( 'qtyNum = packCountNum * packSizeNum = ' + qtyNum );

        extended = totalPaid.toFixed( 2 );
        if( qtyNum > 0 ){
          unitPrice = ( totalPaid / qtyNum ).toFixed( 2 );
        }
        else{
          unitPrice = "0.00";
        }
        qty = qtyNum.toString();

        // Build CSV line
        const fields = [
            storeName,
            tripDate,
            message,
            productName,
            sizeNumber,
            unit,
            packCount,
            unitPrice,
            qty,
            extended
        ];

        const csvLine = fields.map( f => `"${String(f).replace( /"/g, '""' )}"` ).join( ',' );
        saveString += csvLine + '\n';
      });

      if( saveString.split( '\n' ).length <= 2 ){
        alert( "No products were found on this page.\nThe structure might have changed again." );
        return;
      }

      save( saveString, tripDate );
    }
    catch( error ){
      console.error( 'Error in buttonClickAction:', error );
      alert( 'Something went wrong while parsing the shopping list.\n' +
             'Most likely the page HTML structure changed again.\n\n' +
             'Error message:\n' + error.message
      );
    }
    finally{
      $( '#spinner2' ).css( 'visibility', 'hidden' ).removeClass( 'spinning' );
      $( '#rs_fetch_button' ).prop( 'disabled', false ).removeClass('disabled' );
    }
  }

  function addCSS(){
    log( 'addCSS started' );

    const css = `
      .ui-dialog {
        position: fixed !important;
        z-index: 9999;
        background: #FFFFFF;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      }
      .ui-dialog-titlebar {
        background: linear-gradient(135deg, #4CAF50, #2E7D32) !important;
        color: #FFFFFF;
        font: 14px 'Open Sans', Arial, sans-serif;
        font-weight: 600;
        border-radius: 8px 8px 0 0 !important;
        padding: 10px;
      }
      .ui-dialog-titlebar-close {
        display: none !important;
      }
      .ui-dialog-content {
        padding: 10px;
        text-align: center;
      }
      .ui-draggable .ui-dialog-titlebar {
        cursor: move;
      }

      .rs-control-panel {
        top: 150px;
        right: 150px;
        background: #FFFFFF;
        border: 1px solid #ccc;
        border-radius: 8px;
      }

 #rs_fetch_button,
      .rs_button {
        padding: 12px 20px;
        background: linear-gradient( 135deg, #4CAF50, #2E7D32 );
        color: #FFFFFF;
        border: none;
        cursor: pointer;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba( 0, 0, 0, 0.3 );
        font: 13px 'Open Sans', Arial, sans-serif;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        transition: all 0.2s ease;
        margin-top: 20px;
      }

#rs_fetch_button.button-hover:not(.disabled),
      .rs-button:not( .disabled ):hover {
        box-shadow: 0 6px 12px rgba( 0, 0, 0, 0.4 ), 0 0 10px rgba( 76, 175, 80, 0.7 );
        transform: translateY( -2px );
      }

      .glyph-spinner{
        margin-right: 10px;
        visibility: hidden;
        font-size: 24px;
        line-height: 16px;
        display: inline-block;
      }
      .glyph-spinner.spinning{
        animation: spin 5s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @-webkit-keyframes spin {
        0% { -webkit-transform: rotate(0deg); }
        100% { -webkit-transform: rotate(360deg); }
      }
      @-moz-keyframes spin {
        0% { -moz-transform: rotate(0deg); }
        100% { -moz-transform: rotate(360deg); }
      }`;

    $( '<style>' ).text( css ).appendTo( 'head' );

    log( 'CSS injected' );
  }


  function addControlPanel(){
    log( 'addControlPanel started' );

    // Create the dialog content
    var dialogContent = $( '<div>', { id: 'rs_control_panel' });

    // Initialize jQuery UI dialog
    dialogContent.dialog({
      title: 'Get Grocery Shopping History'
      , width: 280
      , height: 250
      , resizable: false
      , draggable: true
      , position: {
        my: 'right top'
        , at: 'right-150 top+150'
        , of: window
      }
      , dialogClass: 'rs-control-panel'
      , closeOnEscape: false
      , handle: '.ui-dialog-titlebar'
      , axis: null
    });

    var fetchButton = $( '<button>', {
          id: 'rs_fetch_button'
      ,class: 'rs-button'
       ,html: '<span class="glyph-spinner" id="spinner2">&#10043;</span> Get Grocery List'
         ,on:{
           click(){
             if( this.classList.contains( 'disabled' ) ){
               return
             };
             log( 'Fetch button clicked' );
             $( this )
               .animate({ transform: 'scale( 0.95 )' }, 100 )
               .animate({ transform: 'scale( 1 )' }, 100 );
             buttonClickAction();
           }
      }
    }).appendTo( dialogContent );


    return dialogContent[0];
  }


  function save(pMessage, pDate) {
    log('save');

    // Convert bad characters to normal ones or remove them entirely.
    pMessage = pMessage.replaceAll('®', '');
    pMessage = pMessage.replaceAll('™', '');
    pMessage = pMessage.replaceAll('’', "'");

    var anchor = document.createElement('a');
    anchor.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(pMessage);
    anchor.download = "Grocery Export " + pDate + ".csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  function triggerThings() {
    addCSS();
    addControlPanel();
  }

  window.setTimeout(triggerThings, 1500);
})();
