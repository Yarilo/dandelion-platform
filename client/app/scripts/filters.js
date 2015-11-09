'use strict';


// Extracted from:
// http://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
dandelionApp.filter('get_unit', function(){
	return function(text){
		var bytes = parseInt(text);
		if(bytes === 0) {return '0 Byte';}
		var k = 1024;
		var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		var i = Math.floor(Math.log(bytes) / Math.log(k));
		return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
	};

});

dandelionApp.filter('date', function(){
	return function(text){
		var date = new Date(text); // Argument should be passed in ms not s
		return date.toLocaleDateString() +" "+ date.toLocaleTimeString();
	};
});

dandelionApp.filter('relative_path', function(){
	return function(text){
		return text.split("/").pop();
	};
});

dandelionApp.filter('nodat', function()
{
	return function(text)
	{
		return text.replace(".dat","");
	}
});
