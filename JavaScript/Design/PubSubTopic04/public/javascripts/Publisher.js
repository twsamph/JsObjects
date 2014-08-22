/**
 * @author Charlie Calvert
 */

// Publisher
define(['TinyPubSub'], function(TinyPubSub) {
	'use strict';
	
	function publisher() {
		console.log("Publisher constructor called.");
		$("#privateButton").click(privateMethod);
		$.publish('debug', {
			message : "Publisher Constructor Called"
		});
	}

	var privateMethod = function() {
		console.log("Publisher private method called.");
		$.publish('debugDetail', 'Publisher privateMethod called by Messenger');
	};

	return {publisher: publisher};

});
