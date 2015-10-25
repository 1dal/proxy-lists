'use strict';

var _ = require('underscore');
var cheerio = require('cheerio');
var css = require('css');
var request = require('request');

var anonymityLevels = {
	'none': 'transparent',
	'low': 'transparent',
	'medium': 'transparent',
	'high': 'anonymous',
	'high +ka': 'elite',
};

var Source = module.exports = {

	homeUrl: 'http://proxylist.hidemyass.com/',

	getProxies: function(options, cb) {

		var requestOptions = {
			method: 'POST',
			url: Source.homeUrl,
			headers: {
				'User-Agent': 'request',
				'X-Requested-With': 'XMLHttpRequest'
			},
			form: {
				c: _.values(options.countries),
				allPorts: 1,
				pl: 'on',// "Planet Labs"?
				pr: [],// types
				a: [],// anonymityLevels
				sp: [
					2,// Medium (speed)
					3,// Fast (speed)
				],
				ct: [
					2,// Medium (connection time)
					3,// Fast (connection time)
				],
				s: 0,// Date tested (sort column)
				o: 0,// Desc (sort direction)
				pp: 3,// 100 per page
				sortBy: 'date',
			}
		};

		if (options.sample) {
			requestOptions.form.pp = 0;
		}

		if (_.contains(options.types, 'http')) {
			requestOptions.form.pr.push(0);
		}

		if (_.contains(options.types, 'https')) {
			requestOptions.form.pr.push(1);
		}

		if (_.contains(options.types, 'socks4') || _.contains(options.types, 'socks5')) {
			requestOptions.form.pr.push(2);
		}

		if (_.contains(options.anonymityLevels, 'transparent')) {
			requestOptions.form.a = requestOptions.form.a.concat([0, 1, 2]);
		}

		if (_.contains(options.anonymityLevels, 'anonymous')) {
			requestOptions.form.a.push(3);
		}

		if (_.contains(options.anonymityLevels, 'elite')) {
			requestOptions.form.a.push(4);
		}

		request(requestOptions, function(error, response, data) {

			if (error) {
				return cb(error);
			}

			try {

				var proxies = Source.parseResponseData(data);

			} catch (error) {
				return cb(error);
			}

			cb(null, proxies);
		});
	},

	parseResponseData: function(data) {

		data = JSON.parse(data);

		var proxies = [];
		var $ = cheerio.load('<table>' + data.table + '</table>');

		$('tr').each(function(index, tr) {

			var proxy = {};
			var ipEl = $('td', tr).eq(1);
			var styles = css.parse(ipEl.find('style').text());

			proxy.port = $('td', tr).eq(2).text().toString();
			proxy.type = $('td', tr).eq(6).text().toString();
			proxy.country = $('td', tr).eq(3).attr('rel').toString();
			proxy.anonymityLevel = $('td', tr).eq(7).text().toString();

			proxy.ip_address = '';

			_.each(styles.stylesheet.rules, function(rule) {

				var applyCss = {};

				_.each(rule.declarations, function(declaration) {
					applyCss[declaration.property] = declaration.value;
				});

				_.each(rule.selectors, function(selector) {
					ipEl.find(selector).css(applyCss);
				});
			});

			_.each(ipEl.children('span')[0].children, function(node) {

				switch (node.type) {

					case 'text':
						proxy.ip_address += node.data;
					break;

					case 'tag':

						if (['span', 'div'].indexOf(node.name) !== -1) {

							var isVisible = $(node).css('display') !== 'none';

							if (isVisible) {

								var contentHtml = $(node).html().toString();
								var contentText = $(node).text().toString();
								var isTextOnly = contentHtml.toString() === contentText.toString();
								var isNonEmpty = contentText !== '';

								if (isTextOnly && isNonEmpty) {
									proxy.ip_address += contentText;
								}
							}
						}

					break;
				}
			});

			proxies.push(proxy);
		});

		proxies = _.map(proxies, function(proxy) {

			proxy.port = parseInt(proxy.port);
			proxy.type = proxy.type.toLowerCase();
			proxy.anonymityLevel = anonymityLevels[proxy.anonymityLevel.toLowerCase()] || null;

			return proxy;
		});

		return proxies;
	}
};