const turndown = require('turndown');
const turndownPluginGfm = require('turndown-plugin-gfm');

function initTurndownService() {
	const turndownService = new turndown({
		headingStyle: 'atx',
		bulletListMarker: '-',
		codeBlockStyle: 'fenced'
	});

	turndownService.use(turndownPluginGfm.tables);

	// preserve embedded tweets
	turndownService.addRule('tweet', {
		filter: node => node.nodeName === 'BLOCKQUOTE' && node.getAttribute('class') === 'twitter-tweet',
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	turndownService.addRule('images', {
		filter: 'img',
		replacement: function (content, node) {
			const html = node.outerHTML.replace(/([>])/, ' loading="lazy"' + '$1');
			return html;
		}
	});

	turndownService.addRule('codeblock', {
		filter: node => {
			return (node.getAttribute("class") === "EnlighterJSRAW" && node.attributes['data-enlighter-language'])
		},
		replacement: (content, node) => {
			var language = node.getAttribute("data-enlighter-language")
			if (language === "raw") {
				language = "typescript";
			}
			return "\n" + "```" + language + "\n" + node.textContent + "\n" + "```" + "\n";
		}})

	turndownService.addRule('codeblock_pre', {
		filter: node => {
			return(node.attributes["lang"])
		},
		replacement: (content, node) => {
			var language = node.getAttribute("lang");
			if(language === "undefined"){
				language = "typescript"
			}
			return "\n" + "```" + language + "\n" + node.textContent + "\n" + "```" + "\n";
		}
	})

	// preserve embedded codepens
	turndownService.addRule('codepen', {
		filter: node => {
			// codepen embed snippets have changed over the years
			// but this series of checks should find the commonalities
			return (
				['P', 'DIV'].includes(node.nodeName) &&
				node.attributes['data-slug-hash'] &&
				node.getAttribute('class') === 'codepen'
			);
		},
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded scripts (for tweets, codepens, gists, etc.)
	turndownService.addRule('script', {
		filter: 'script',
		replacement: (content, node) => {
			let before = '\n\n';
			if (node.previousSibling && node.previousSibling.nodeName !== '#text') {
				// keep twitter and codepen <script> tags snug with the element above them
				before = '\n';
			}
			const html = node.outerHTML.replace('async=""', 'async');
			return before + html + '\n\n';
		}
	});

	// preserve iframes (common for embedded audio/video)
	turndownService.addRule('iframe', {
		filter: 'iframe',
		replacement: (content, node) => {
			const html = node.outerHTML.replace('allowfullscreen=""', 'allowfullscreen');
			return '\n\n' + html + '\n\n';
		}
	});

	return turndownService;
}

function getHighestHeader(content) {
	if(content.includes('<h1>')) {
		return 1;
	}
	if(content.includes('<h2>')) {
		return 2;
	}
	if(content.includes('<h3>')) {
		return 3;
	}
	if(content.includes('<h4>')) {
		return 4;
	}
	if(content.includes('<h5>')) {
		return 5;
	}
	if(content.includes('<h6>')) {
		return 6;
	}
	return 1;
}

function getPostContent(post, turndownService, config) {
	let content = post.encoded[0];

	content = content.replace(/<h(\d).{0,}id="(.*?)".{0,}?>(.*?)<\/h\d>/, '<h$1>anchorLink123 name="$2">/anchorLink123>$3</h$1>');

	let highestHeader = getHighestHeader(content);
	switch(highestHeader) { 
		case 1: {
			content = content.replaceAll('<h5>', '<h6>');
			content = content.replaceAll('</h5>', '</h6>');
			content = content.replaceAll('<h4>', '<h6>');
			content = content.replaceAll('</h4>', '</h6>');
			content = content.replaceAll('<h3>', '<h5>');
			content = content.replaceAll('</h3>', '</h5>');
			content = content.replaceAll('<h2>', '<h4>');
			content = content.replaceAll('</h2>', '</h4>');
			content = content.replaceAll('<h1>', '<h3>');
			content = content.replaceAll('</h1>', '</h3>');
			break; 
		}
		default: {
			break; 
		} 
	} 

	// insert an empty div element between double line breaks
	// this nifty trick causes turndown to keep adjacent paragraphs separated
	// without mucking up content inside of other elemnts (like <code> blocks)
	content = content.replace(/(\r?\n){2}/g, '\n<div></div>\n');

	if (config.saveScrapedImages) {
		// writeImageFile() will save all content images to a relative /images
		// folder so update references in post content to match
		content = content.replace(/(<img[^>]*src=").*?([^/"]+\.(?:gif|jpe?g|png))("[^>]*>)/gi, '$1images/$2$3');
	}

	// this is a hack to make <iframe> nodes non-empty by inserting a "." which
	// allows the iframe rule declared in initTurndownService() to take effect
	// (using turndown's blankRule() and keep() solution did not work for me)
	content = content.replace(/(<\/iframe>)/gi, '.$1');

	// use turndown to convert HTML to Markdown
	content = turndownService.turndown(content);

	// clean up extra spaces in list items
	content = content.replace(/(-|\d+\.) +/g, '$1 ');

	// clean up the "." from the iframe hack above
	content = content.replace(/\.(<\/iframe>)/gi, '$1');
	content = content.replace('/anchorLink123', '</a');
	content = content.replace('anchorLink123', '<a');

	return content;
}

exports.initTurndownService = initTurndownService;
exports.getPostContent = getPostContent;
