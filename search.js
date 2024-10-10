/**
 * Search
 *
 * Basically just an improved version of utilichart
 *
 * Dependencies: jQuery, battledata, search-index
 * Optional dependencies: pokedex, moves, items, abilities
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 */
const metaList = ["2023_7", "2023_8", "2023_9", "2023_10", "2023_10_B", "2023_11", "2023_12", "2024_1", "2024_2", "2024_3", "2024_4", "2024_5", "2024_6", "2024_7", "2024_8", "2024_9", "2024_10"];
const challengeCodePrefix = '/challenge gen9nationaldexag @@@ Z-Move Clause, -Mega, Terastal Clause, Sleep Clause Mod, Forme Clause, -Hidden Power, -Last Respects, -Kings Rock, -Shadow Tag, -Acupressure, -Battle Bond, -Quick Claw, -Razor Fang, Evasion Clause, OHKO Clause, baton pass stat trap clause, -All Pokemon, +';
const metaMap = new Map();
metaList.forEach((date) => {
	$.getJSON(`https://samuel-peter-chowdhury.github.io/35PokesShowdownFilter/dates/${date}.json`, function(data) {
		const set = new Set(data);
		metaMap.set(date, set);
	});
});

let yearFilter = localStorage.getItem("35-pokes-year");
if (!yearFilter) {
	yearFilter = 2024;
	localStorage.setItem("35-pokes-year", yearFilter);
}
let monthFilter = localStorage.getItem("35-pokes-month");
if (!monthFilter) {
	monthFilter = 2;
	localStorage.setItem("35-pokes-month", monthFilter);
}
let altFilter = localStorage.getItem("35-pokes-alt");
if (!altFilter) {
	altFilter = '';
	localStorage.setItem("35-pokes-alt", altFilter);
}

function getMeta(year, month, alt) {
	return `${String(year)}_${String(month)}${(alt != '' && alt != undefined && alt != null) ? ('_' + alt) : ''}`;
}

function fallbackCopyTextToClipboard(text) {
	var textArea = document.createElement("textarea");
	textArea.value = text;
	
	textArea.style.top = "0";
	textArea.style.left = "0";
	textArea.style.position = "fixed";
  
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();
  
	try {
	  var successful = document.execCommand('copy');
	  var msg = successful ? 'successful' : 'unsuccessful';
	  console.log('Fallback: Copying text command was ' + msg);
	} catch (err) {
	  console.error('Fallback: Oops, unable to copy', err);
	}
	
	document.body.removeChild(textArea);
}

function copyTextToClipboard(text) {
	if (!navigator.clipboard) {
	  fallbackCopyTextToClipboard(text);
	  return;
	}
	navigator.clipboard.writeText(text).then(function() {
	  console.log('Async: Copying to clipboard was successful!');
	}, function(err) {
	  console.error('Async: Could not copy text: ', err);
	});
}

(function (exports, $) {
	'use strict';

	function Search(elem, viewport) {
		this.$el = $(elem);
		this.el = this.$el[0];
		this.$viewport = (viewport ? $(viewport) : $(window));

		this.urlRoot = '';
		this.q = undefined; // uninitialized
		this.exactMatch = false;

		this.resultSet = null;
		this.filters = null;
		this.sortCol = null;
		this.renderedIndex = 0;
		this.renderingDone = true;
		this.externalFilter = false;
		this.cur = {};
		this.$inputEl = null;
		this.gen = 9;
		this.mod = null;

		this.engine = new DexSearch();
		window.search = this;

		var self = this;
		this.$el.on('click', '.more button', function (e) {
			e.preventDefault();
			self.updateScroll(true);
		});
		this.$el.on('click', '.filter', function (e) {
			e.preventDefault();
			self.removeFilter(e);
			if (self.$inputEl) self.$inputEl.focus();
		});
		this.$el.on('click', '.sortcol', function (e) {
			e.preventDefault();
			e.stopPropagation();
			var sortCol = e.currentTarget.dataset.sort;
			self.engine.toggleSort(sortCol);
			self.sortCol = self.engine.sortCol;
			self.find('');
		});
		this.$el.on('click', '#35-pokes-filter-button', function (e) {
			e.preventDefault();
			e.stopPropagation();
			tempYear = document.getElementById("35-pokes-year").value;
			tempMonth = document.getElementById("35-pokes-month").value;
			tempAlt = document.getElementById("35-pokes-alt").value;
			if (metaMap.has(getMeta(tempYear, tempMonth, tempAlt))) {
				yearFilter = tempYear;
				localStorage.setItem("35-pokes-year", yearFilter);
				monthFilter = tempMonth;
				localStorage.setItem("35-pokes-month", monthFilter);
				altFilter = tempAlt;
				localStorage.setItem("35-pokes-alt", altFilter);
				self.renderedIndex = 0;
				self.renderingDone = false;
				self.updateScroll();
			}
		});
		this.$el.on('click', '#35-pokes-copy-button', function (e) {
			e.preventDefault();
			e.stopPropagation();
			const pokemonList = Array.from(metaMap.get(getMeta(yearFilter, monthFilter, altFilter))).join(', +');
			copyTextToClipboard(challengeCodePrefix + pokemonList);
		});
	}

	Search.prototype.$ = function (query) {
		return this.$el.find(query);
	};

	//
	// Search functions
	//

	Search.prototype.find = function (query, firstElem) {
		if (!this.engine.find(query)) return; // nothing changed

		this.exactMatch = this.engine.exactMatch;
		this.q = this.engine.query;
		this.resultSet = this.engine.results;
		if (firstElem) {
			this.resultSet = [[this.engine.typedSearch.searchType, firstElem]].concat(this.resultSet);
			if (this.resultSet.length > 1 && ['sortpokemon', 'sortmove'].includes(this.resultSet[1][0])) {
				var sortRow = this.resultSet[1];
				this.resultSet[1] = this.resultSet[0];
				this.resultSet[0] = sortRow;
			}
		}
		if (this.filters) {
			this.resultSet = [['html', this.getFilterText()]].concat(this.resultSet);
		}

		this.renderedIndex = 0;
		this.renderingDone = false;
		this.updateScroll();
		return true;
	};
	Search.prototype.addFilter = function (node) {
		if (!node.dataset.entry) return false;
		var entry = node.dataset.entry.split('|');
		var result = this.engine.addFilter(entry);
		this.filters = this.engine.filters;
		return result;
	};
	Search.prototype.removeFilter = function (e) {
		var result;
		if (e) {
			result = this.engine.removeFilter(e.currentTarget.value.split(':'));
		} else {
			result = this.engine.removeFilter();
		}
		this.filters = this.engine.filters;
		this.find('');
		return result;
	};
	Search.prototype.getFilterText = function (q) {
		var buf = '<p>Filters: ';
		for (var i = 0; i < this.filters.length; i++) {
			var text = this.filters[i][1];
			if (this.filters[i][0] === 'move') text = Dex.moves.get(text).name;
			if (this.filters[i][0] === 'pokemon') text = Dex.species.get(text).name;
			buf += '<button class="filter" value="' + BattleLog.escapeHTML(this.filters[i].join(':')) + '">' + text + ' <i class="fa fa-times-circle"></i></button> ';
		}
		if (!q) buf += '<small style="color: #888">(backspace = delete filter)</small>';
		return buf + '</p>';
	};
	Search.prototype.updateScroll = function (forceAdd) {
		if (this.renderingDone) return;
		var top = this.$viewport.scrollTop();
		var bottom = top + this.$viewport.height();
		var windowHeight = $(window).height();
		var i = this.renderedIndex;
		var finalIndex = Math.floor(bottom / 33) + 1;
		if (!forceAdd && finalIndex <= i) return;
		if (finalIndex < i + 20) finalIndex = i + 20;
		if (bottom - top > windowHeight && !i) finalIndex = 20;
		if (forceAdd && finalIndex > i + 40) finalIndex = i + 40;
		finalIndex = 9999;

		var resultSet = this.resultSet;
		var buf = '';
		while (i < finalIndex) {
			if (!resultSet[i]) {
				this.renderingDone = true;
				break;
			}
			var row = resultSet[i];

			var errorMessage = '';
			var label;
			if ((label = this.engine.filterLabel(row[0]))) {
				errorMessage = '<span class="col filtercol"><em>' + label + '</em></span>';
			} else if ((label = this.engine.illegalLabel(row[1]))) {
				errorMessage = '<span class="col illegalcol"><em>' + label + '</em></span>';
			}

			var mStart = 0;
			var mEnd = 0;
			if (row.length > 3) {
				mStart = row[2];
				mEnd = row[3];
			}
			buf += this.renderRow(row[1], row[0], mStart, mEnd, errorMessage, row[1] in this.cur ? ' class="cur"' : '');

			i++;
		}
		if (!this.renderedIndex) {
			this.el.innerHTML = '<ul class="utilichart" style="height:fit-content">' + buf + (!this.renderingDone ? '<li class="result more"><p><button class="button big">More</button></p></li>' : '') + '</ul>';
			this.moreVisible = true;
		} else {
			if (this.moreVisible) {
				this.$el.find('.more').remove();
				if (!forceAdd) this.moreVisible = false;
			}
			$(this.el.firstChild).append(buf + (forceAdd && !this.renderingDone ? '<li class="result more"><p><button class="button big">More</button></p></li>' : ''));
		}
		this.renderedIndex = i;
	};
	Search.prototype.setType = function (qType, format, set, cur) {
		this.engine.setType(qType, format, set);
		this.filters = this.engine.filters;
		this.sortCol = this.engine.sortCol;
		this.cur = cur || {};
		var firstElem;
		for (var id in cur) {
			firstElem = id;
			break;
		}
		this.find('', firstElem);
	};

	/*********************************************************
	 * Rendering functions
	 *********************************************************/

	// These all have static versions

	Search.prototype.renderRow = function (id, type, matchStart, matchLength, errorMessage, attrs) {
		// errorMessage = '<span class="col illegalcol"><em>' + errorMessage + '</em></span>';
		switch (type) {
		case 'html':
			return '<li class="result">' + id + '</li>';
		case 'header':
			const lowerId = id.toLowerCase();
			if (lowerId.includes('items') || lowerId.includes('abilit') || lowerId.includes('moves')) {
				return '<li class="result"><h3>' + id + '</h3></li>';
			} else {
				return '';
			}
		case 'sortpokemon':
			return this.renderPokemonSortRow();
		case 'sortmove':
			return this.renderMoveSortRow();
		case 'pokemon':
			var pokemon = this.engine.dex.species.get(id);
			if (metaMap.get(getMeta(yearFilter, monthFilter, altFilter)).has(id)) {
				return this.renderPokemonRow(pokemon, matchStart, matchLength, errorMessage, attrs);
			} else {
				return '';
			}
		case 'move':
			var move = this.engine.dex.moves.get(id);
			return this.renderMoveRow(move, matchStart, matchLength, errorMessage, attrs);
		case 'item':
			var item = this.engine.dex.items.get(id);
			return this.renderItemRow(item, matchStart, matchLength, errorMessage, attrs);
		case 'ability':
			var ability = this.engine.dex.abilities.get(id);
			return this.renderAbilityRow(ability, matchStart, matchLength, errorMessage, attrs);
		case 'type':
			var type = {name: id[0].toUpperCase() + id.substr(1)};
			return this.renderTypeRow(type, matchStart, matchLength, errorMessage);
		case 'egggroup':
			// very hardcode
			var egName;
			if (id === 'humanlike') egName = 'Human-Like';
			else if (id === 'water1') egName = 'Water 1';
			else if (id === 'water2') egName = 'Water 2';
			else if (id === 'water3') egName = 'Water 3';
			if (egName) {
				if (matchLength > 5) matchLength++;
			} else {
				egName = id[0].toUpperCase() + id.substr(1);
			}
			var egggroup = {name: egName};
			return this.renderEggGroupRow(egggroup, matchStart, matchLength, errorMessage);
		case 'tier':
			// very hardcode
			var tierTable = {
				uber: "Uber",
				ou: "OU",
				uu: "UU",
				ru: "RU",
				nu: "NU",
				pu: "PU",
				zu: "ZU",
				nfe: "NFE",
				lc: "LC",
				cap: "CAP",
				caplc: "CAP LC",
				capnfe: "CAP NFE",
				uubl: "UUBL",
				rubl: "RUBL",
				nubl: "NUBL",
				publ: "PUBL",
				zubl: "ZUBL"
			};
			var tier = {name: tierTable[id]};
			return this.renderTierRow(tier, matchStart, matchLength, errorMessage);
		case 'category':
			var category = {name: id[0].toUpperCase() + id.substr(1), id: id};
			return this.renderCategoryRow(category, matchStart, matchLength, errorMessage);
		case 'article':
			var articleTitle = (window.BattleArticleTitles && BattleArticleTitles[id]) || (id[0].toUpperCase() + id.substr(1));
			var article = {name: articleTitle, id: id};
			return this.renderArticleRow(article, matchStart, matchLength, errorMessage);
		}
		return 'Error: not found';
	};
	Search.prototype.renderPokemonSortRow = function () {
		var buf = '<li class="result" style="display: flex; align-items: center; padding: 0 10px; justify-content: space-between">'
		buf += '<div style="display: flex; align-items: center;">'
		buf += '<select id="35-pokes-month" name="35-pokes-month" class="button" style="margin-right: 5px;">'
		buf += `<option value="1"${monthFilter == 1 ? ' selected="selected"' : ''}">Jan</option>`
		buf += `<option value="2"${monthFilter == 2 ? ' selected="selected"' : ''}">Feb</option>`
		buf += `<option value="3"${monthFilter == 3 ? ' selected="selected"' : ''}">Mar</option>`
		buf += `<option value="4"${monthFilter == 4 ? ' selected="selected"' : ''}">Apr</option>`
		buf += `<option value="5"${monthFilter == 5 ? ' selected="selected"' : ''}">May</option>`
		buf += `<option value="6"${monthFilter == 6 ? ' selected="selected"' : ''}">Jun</option>`
		buf += `<option value="7"${monthFilter == 7 ? ' selected="selected"' : ''}">Jul</option>`
		buf += `<option value="8"${monthFilter == 8 ? ' selected="selected"' : ''}">Aug</option>`
		buf += `<option value="9"${monthFilter == 9 ? ' selected="selected"' : ''}">Sep</option>`
		buf += `<option value="10"${monthFilter == 10 ? ' selected="selected"' : ''}">Oct</option>`
		buf += `<option value="11"${monthFilter == 11 ? ' selected="selected"' : ''}">Nov</option>`
		buf += `<option value="12"${monthFilter == 12 ? ' selected="selected"' : ''}">Dec</option>`
		buf += '</select>'
		buf += '<select id="35-pokes-year" name="35-pokes-year" class="button" style="margin-right: 5px;">'
		buf += `<option value="2023"${yearFilter == 2023 ? ' selected="selected"' : ''}">2023</option>`
		buf += `<option value="2024"${yearFilter == 2024 ? ' selected="selected"' : ''}">2024</option>`
		buf += `<option value="2025"${yearFilter == 2025 ? ' selected="selected"' : ''}">2025</option>`
		buf += `<option value="2026"${yearFilter == 2026 ? ' selected="selected"' : ''}">2026</option>`
		buf += `<option value="2027"${yearFilter == 2027 ? ' selected="selected"' : ''}">2027</option>`
		buf += `<option value="2028"${yearFilter == 2028 ? ' selected="selected"' : ''}">2028</option>`
		buf += `<option value="2029"${yearFilter == 2029 ? ' selected="selected"' : ''}">2029</option>`
		buf += `<option value="2030"${yearFilter == 2030 ? ' selected="selected"' : ''}">2030</option>`
		buf += '</select>'
		buf += `<input type="text" id="35-pokes-alt" name="35-pokes-alt" class="textbox" value="${altFilter}" style="width: 50px; height: 18px; margin-right: 5px;">`
		buf += '<button id="35-pokes-filter-button" name="35-pokes-filter-button" class="button" style="height: 24px; margin-right: 5px;">Filter</button>'
		buf += '<button id="35-pokes-copy-button" name="35-pokes-copy-button" class="button" style="height: 24px;">Challenge Code</button>'
		buf += '</div>'
		buf += '<div style="display: flex; align-items: center;">'
		buf += `<button id="35-pokes-power-button" name="35-pokes-power-button" class="button" style="height: 24px; margin-right: 10px;"><i class="fa fa-power-off" style="color: #008000;"></i></button>`
		buf += '</div>'
		buf += '</li>';
		buf += '<li class="result"><div class="sortrow">';
		buf += '<button class="sortcol numsortcol' + (!this.sortCol ? ' cur' : '') + '">' + (!this.sortCol ? 'Sort: ' : this.engine.firstPokemonColumn) + '</button>';
		buf += '<button class="sortcol pnamesortcol' + (this.sortCol === 'name' ? ' cur' : '') + '" data-sort="name">Name</button>';
		buf += '<button class="sortcol typesortcol' + (this.sortCol === 'type' ? ' cur' : '') + '" data-sort="type">Types</button>';
		buf += '<button class="sortcol abilitysortcol' + (this.sortCol === 'ability' ? ' cur' : '') + '" data-sort="ability">Abilities</button>';
		buf += '<button class="sortcol statsortcol' + (this.sortCol === 'hp' ? ' cur' : '') + '" data-sort="hp">HP</button>';
		buf += '<button class="sortcol statsortcol' + (this.sortCol === 'atk' ? ' cur' : '') + '" data-sort="atk">Atk</button>';
		buf += '<button class="sortcol statsortcol' + (this.sortCol === 'def' ? ' cur' : '') + '" data-sort="def">Def</button>';
		if (this.engine.dex.gen >= 2) {
			buf += '<button class="sortcol statsortcol' + (this.sortCol === 'spa' ? ' cur' : '') + '" data-sort="spa">SpA</button>';
			buf += '<button class="sortcol statsortcol' + (this.sortCol === 'spd' ? ' cur' : '') + '" data-sort="spd">SpD</button>';
		} else {
			buf += '<button class="sortcol statsortcol' + (this.sortCol === 'spa' ? ' cur' : '') + '" data-sort="spa">Spc</button>';
		}
		buf += '<button class="sortcol statsortcol' + (this.sortCol === 'spe' ? ' cur' : '') + '" data-sort="spe">Spe</button>';
		buf += '<button class="sortcol statsortcol' + (this.sortCol === 'bst' ? ' cur' : '') + '" data-sort="bst">BST</button>';
		buf += '</div></li>';
		return buf;
	};
	Search.prototype.renderMoveSortRow = function () {
		var buf = '<li class="result"><div class="sortrow">';
		buf += '<button class="sortcol movenamesortcol' + (this.sortCol === 'name' ? ' cur' : '') + '" data-sort="name">Name</button>';
		buf += '<button class="sortcol movetypesortcol' + (this.sortCol === 'type' ? ' cur' : '') + '" data-sort="type">Type</button>';
		buf += '<button class="sortcol movetypesortcol' + (this.sortCol === 'category' ? ' cur' : '') + '" data-sort="category">Cat</button>';
		buf += '<button class="sortcol powersortcol' + (this.sortCol === 'power' ? ' cur' : '') + '" data-sort="power">Pow</button>';
		buf += '<button class="sortcol accuracysortcol' + (this.sortCol === 'accuracy' ? ' cur' : '') + '" data-sort="accuracy">Acc</button>';
		buf += '<button class="sortcol ppsortcol' + (this.sortCol === 'pp' ? ' cur' : '') + '" data-sort="pp">PP</button>';
		buf += '</div></li>';
		return buf;
	};
	Search.prototype.renderPokemonRow = function (pokemon, matchStart, matchLength, errorMessage, attrs) {
		if (!attrs) attrs = '';
		if (!pokemon) return '<li class="result">Unrecognized pokemon</li>';
		var id = toID(pokemon.name);
		if (Search.urlRoot) attrs += ' href="' + Search.urlRoot + 'pokemon/' + id + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="pokemon|' + BattleLog.escapeHTML(pokemon.name) + '">';

		// number
		var tier = this.engine ? this.engine.getTier(pokemon) : pokemon.num;
		// buf += '<span class="col numcol">' + (pokemon.num >= 0 ? pokemon.num : 'CAP') + '</span> ';
		buf += '<span class="col numcol">' + tier + '</span> ';

		// icon
		buf += '<span class="col iconcol">';
		buf += '<span style="' + Dex.getPokemonIcon(pokemon.name) + '"></span>';
		buf += '</span> ';

		// name
		var name = pokemon.name;
		var tagStart = (pokemon.forme ? name.length - pokemon.forme.length - 1 : 0);
		if (tagStart) name = name.substr(0, tagStart);
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		if (tagStart) {
			if (matchLength && matchStart + matchLength > tagStart) {
				if (matchStart < tagStart) {
					matchLength -= tagStart - matchStart;
					matchStart = tagStart;
				}
				name += '<small>' + pokemon.name.substr(tagStart, matchStart - tagStart) + '<b>' + pokemon.name.substr(matchStart, matchLength) + '</b>' + pokemon.name.substr(matchStart + matchLength) + '</small>';
			} else {
				name += '<small>' + pokemon.name.substr(tagStart) + '</small>';
			}
		}
		buf += '<span class="col pokemonnamecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		var gen = this.engine ? this.engine.dex.gen : 9;

		// type
		buf += '<span class="col typecol">';
		var types = pokemon.types;
		for (var i = 0; i < types.length; i++) {
			buf += Dex.getTypeIcon(types[i]);
		}
		buf += '</span> ';

		// abilities
		if (gen >= 3) {
			var abilities = Dex.forGen(gen).species.get(id).abilities;
			if (gen >= 5) {
				if (abilities['1']) {
					buf += '<span class="col twoabilitycol">' + abilities['0'] + '<br />' +
						abilities['1'] + '</span>';
				} else {
					buf += '<span class="col abilitycol">' + abilities['0'] + '</span>';
				}
				var unreleasedHidden = pokemon.unreleasedHidden;
				if (unreleasedHidden === 'Past' && (this.mod === 'natdex' || gen < 8)) unreleasedHidden = false;
				if (abilities['S']) {
					if (abilities['H']) {
						buf += '<span class="col twoabilitycol' + (unreleasedHidden ? ' unreleasedhacol' : '') + '">' + (abilities['H'] || '') + '<br />(' + abilities['S'] + ')</span>';
					} else {
						buf += '<span class="col abilitycol">(' + abilities['S'] + ')</span>';
					}
				} else if (abilities['H']) {
					buf += '<span class="col abilitycol' + (unreleasedHidden ? ' unreleasedhacol' : '') + '">' + abilities['H'] + '</span>';
				} else {
					buf += '<span class="col abilitycol"></span>';
				}
			} else {
				buf += '<span class="col abilitycol">' + abilities['0'] + '</span>';
				buf += '<span class="col abilitycol">' + (abilities['1'] ? abilities['1'] : '') + '</span>';
			}
		} else {
			buf += '<span class="col abilitycol"></span>';
			buf += '<span class="col abilitycol"></span>';
		}

		// base stats
		var stats = pokemon.baseStats;
		buf += '<span class="col statcol"><em>HP</em><br />' + stats.hp + '</span> ';
		buf += '<span class="col statcol"><em>Atk</em><br />' + stats.atk + '</span> ';
		buf += '<span class="col statcol"><em>Def</em><br />' + stats.def + '</span> ';
		if (gen >= 2) {
			buf += '<span class="col statcol"><em>SpA</em><br />' + stats.spa + '</span> ';
			buf += '<span class="col statcol"><em>SpD</em><br />' + stats.spd + '</span> ';
		} else {
			buf += '<span class="col statcol"><em>Spc</em><br />' + stats.spa + '</span> ';
		}
		buf += '<span class="col statcol"><em>Spe</em><br />' + stats.spe + '</span> ';
		var bst = 0;
		for (i in stats) {
			if (i === 'spd' && gen === 1) continue;
			bst += stats[i];
		}
		buf += '<span class="col bstcol"><em>BST<br />' + bst + '</em></span> ';

		buf += '</a></li>';

		return buf;
	};
	Search.prototype.renderTaggedPokemonRowInner = function (pokemon, tag, errorMessage) {
		var attrs = '';
		if (Search.urlRoot) attrs = ' href="' + Search.urlRoot + 'pokemon/' + toID(pokemon.name) + '" data-target="push"';
		var buf = '<a' + attrs + ' data-entry="pokemon|' + BattleLog.escapeHTML(pokemon.name) + '">';

		// tag
		buf += '<span class="col tagcol shorttagcol">' + tag + '</span> ';

		// icon
		buf += '<span class="col iconcol">';
		buf += '<span style="' + Dex.getPokemonIcon(pokemon.name) + '"></span>';
		buf += '</span> ';

		// name
		var name = pokemon.name;
		var tagStart = (pokemon.forme ? name.length - pokemon.forme.length - 1 : 0);
		if (tagStart) name = name.substr(0, tagStart) + '<small>' + pokemon.name.substr(tagStart) + '</small>';
		buf += '<span class="col shortpokemonnamecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		// type
		buf += '<span class="col typecol">';
		for (var i = 0; i < pokemon.types.length; i++) {
			buf += Dex.getTypeIcon(pokemon.types[i]);
		}
		buf += '</span> ';

		// abilities
		buf += '<span style="float:left;min-height:26px">';
		if (pokemon.abilities['1']) {
			buf += '<span class="col twoabilitycol">';
		} else {
			buf += '<span class="col abilitycol">';
		}
		for (var i in pokemon.abilities) {
			var ability = pokemon.abilities[i];
			if (!ability) continue;

			if (i === '1') buf += '<br />';
			if (i === 'H') ability = '</span><span class="col abilitycol"><em>' + pokemon.abilities[i] + '</em>';
			buf += ability;
		}
		if (!pokemon.abilities['H']) buf += '</span><span class="col abilitycol">';
		buf += '</span>';
		buf += '</span>';

		// base stats
		buf += '<span style="float:left;min-height:26px">';
		buf += '<span class="col statcol"><em>HP</em><br />' + pokemon.baseStats.hp + '</span> ';
		buf += '<span class="col statcol"><em>Atk</em><br />' + pokemon.baseStats.atk + '</span> ';
		buf += '<span class="col statcol"><em>Def</em><br />' + pokemon.baseStats.def + '</span> ';
		buf += '<span class="col statcol"><em>SpA</em><br />' + pokemon.baseStats.spa + '</span> ';
		buf += '<span class="col statcol"><em>SpD</em><br />' + pokemon.baseStats.spd + '</span> ';
		buf += '<span class="col statcol"><em>Spe</em><br />' + pokemon.baseStats.spe + '</span> ';
		var bst = 0;
		for (i in pokemon.baseStats) bst += pokemon.baseStats[i];
		buf += '<span class="col bstcol"><em>BST<br />' + bst + '</em></span> ';
		buf += '</span>';

		buf += '</a>';

		return buf;
	};

	Search.prototype.renderItemRow = function (item, matchStart, matchLength, errorMessage, attrs) {
		if (!attrs) attrs = '';
		if (!item) return '<li class="result">Unrecognized item</li>';
		var id = toID(item.name);
		if (Search.urlRoot) attrs += ' href="' + Search.urlRoot + 'items/' + id + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="item|' + BattleLog.escapeHTML(item.name) + '">';

		// icon
		buf += '<span class="col itemiconcol">';
		buf += '<span style="' + Dex.getItemIcon(item) + '"></span>';
		buf += '</span> ';

		// name
		var name = item.name;
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		buf += '<span class="col namecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		// desc
		buf += '<span class="col itemdesccol">' + BattleLog.escapeHTML(item.shortDesc) + '</span> ';

		buf += '</a></li>';

		return buf;
	};
	Search.prototype.renderAbilityRow = function (ability, matchStart, matchLength, errorMessage, attrs) {
		if (!attrs) attrs = '';
		if (!ability) return '<li class="result">Unrecognized ability</li>';
		var id = toID(ability.name);
		if (Search.urlRoot) attrs += ' href="' + Search.urlRoot + 'abilities/' + id + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="ability|' + BattleLog.escapeHTML(ability.name) + '">';

		// name
		var name = ability.name;
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		buf += '<span class="col namecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		buf += '<span class="col abilitydesccol">' + BattleLog.escapeHTML(ability.shortDesc) + '</span> ';

		buf += '</a></li>';

		return buf;
	};
	Search.prototype.renderMoveRow = function (move, matchStart, matchLength, errorMessage, attrs) {
		if (!attrs) attrs = '';
		if (!move) return '<li class="result">Unrecognized move</li>';
		var id = toID(move.name);
		if (Search.urlRoot) attrs += ' href="' + Search.urlRoot + 'moves/' + id + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="move|' + BattleLog.escapeHTML(move.name) + '">';

		// name
		var name = move.name;
		var tagStart = (name.substr(0, 12) === 'Hidden Power' ? 12 : 0);
		if (tagStart) name = name.substr(0, tagStart);
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		if (tagStart) {
			if (matchLength && matchStart + matchLength > tagStart) {
				if (matchStart < tagStart) {
					matchLength -= tagStart - matchStart;
					matchStart = tagStart;
				}
				name += '<small>' + move.name.substr(tagStart, matchStart - tagStart) + '<b>' + move.name.substr(matchStart, matchLength) + '</b>' + move.name.substr(matchStart + matchLength) + '</small>';
			} else {
				name += '<small>' + move.name.substr(tagStart) + '</small>';
			}
		}
		buf += '<span class="col movenamecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		// type
		buf += '<span class="col typecol">';
		buf += Dex.getTypeIcon(move.type);
		buf += Dex.getCategoryIcon(move.category);
		buf += '</span> ';

		// power, accuracy, pp
		var pp = (move.pp === 1 || move.noPPBoosts ? move.pp : move.pp * 8 / 5);
		if (this.engine && this.engine.dex.gen < 3) pp = Math.min(61, pp);
		buf += '<span class="col labelcol">' + (move.category !== 'Status' ? ('<em>Power</em><br />' + (move.basePower || '&mdash;')) : '') + '</span> ';
		buf += '<span class="col widelabelcol"><em>Accuracy</em><br />' + (move.accuracy && move.accuracy !== true ? move.accuracy + '%' : '&mdash;') + '</span> ';
		buf += '<span class="col pplabelcol"><em>PP</em><br />' + pp + '</span> ';

		// desc
		buf += '<span class="col movedesccol">' + BattleLog.escapeHTML(move.shortDesc) + '</span> ';

		buf += '</a></li>';

		return buf;
	};
	Search.prototype.renderMoveRowInner = function (move, errorMessage) {
		var attrs = '';
		if (Search.urlRoot) attrs = ' href="' + Search.urlRoot + 'moves/' + toID(move.name) + '" data-target="push"';
		var buf = '<a' + attrs + ' data-entry="move|' + BattleLog.escapeHTML(move.name) + '">';

		// name
		var name = move.name;
		var tagStart = (name.substr(0, 12) === 'Hidden Power' ? 12 : 0);
		if (tagStart) name = name.substr(0, tagStart) + '<small>' + move.name.substr(tagStart) + '</small>';
		buf += '<span class="col movenamecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		// type
		buf += '<span class="col typecol">';
		buf += Dex.getTypeIcon(move.type);
		buf += Dex.getCategoryIcon(move.category);
		buf += '</span> ';

		// power, accuracy, pp
		var pp = (move.pp === 1 || move.noPPBoosts ? move.pp : move.pp * 8 / 5);
		if (this.engine && this.engine.dex.gen < 3) pp = Math.min(61, pp);
		buf += '<span class="col labelcol">' + (move.category !== 'Status' ? ('<em>Power</em><br />' + (move.basePower || '&mdash;')) : '') + '</span> ';
		buf += '<span class="col widelabelcol"><em>Accuracy</em><br />' + (move.accuracy && move.accuracy !== true ? move.accuracy + '%' : '&mdash;') + '</span> ';
		buf += '<span class="col pplabelcol"><em>PP</em><br />' + pp + '</span> ';

		// desc
		buf += '<span class="col movedesccol">' + BattleLog.escapeHTML(move.shortDesc || move.desc) + '</span> ';

		buf += '</a>';

		return buf;
	};
	Search.prototype.renderTaggedMoveRow = function (move, tag, errorMessage) {
		var attrs = '';
		if (Search.urlRoot) attrs = ' href="' + Search.urlRoot + 'moves/' + toID(move.name) + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="move|' + BattleLog.escapeHTML(move.name) + '">';

		// tag
		buf += '<span class="col tagcol">' + tag + '</span> ';

		// name
		var name = move.name;
		if (name.substr(0, 12) === 'Hidden Power') name = 'Hidden Power';
		buf += '<span class="col shortmovenamecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		// type
		buf += '<span class="col typecol">';
		buf += Dex.getTypeIcon(move.type);
		buf += Dex.getCategoryIcon(move.category);
		buf += '</span> ';

		// power, accuracy, pp
		buf += '<span class="col labelcol">' + (move.category !== 'Status' ? ('<em>Power</em><br />' + (move.basePower || '&mdash;')) : '') + '</span> ';
		buf += '<span class="col widelabelcol"><em>Accuracy</em><br />' + (move.accuracy && move.accuracy !== true ? move.accuracy + '%' : '&mdash;') + '</span> ';
		buf += '<span class="col pplabelcol"><em>PP</em><br />' + (move.pp !== 1 ? move.pp * 8 / 5 : move.pp) + '</span> ';

		// desc
		buf += '<span class="col movedesccol">' + BattleLog.escapeHTML(move.shortDesc || move.desc) + '</span> ';

		buf += '</a></li>';

		return buf;
	};

	Search.prototype.renderTypeRow = function (type, matchStart, matchLength, errorMessage) {
		var attrs = '';
		if (Search.urlRoot) attrs = ' href="' + Search.urlRoot + 'types/' + toID(type.name) + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="type|' + BattleLog.escapeHTML(type.name) + '">';

		// name
		var name = type.name;
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		buf += '<span class="col namecol">' + name + '</span> ';

		// type
		buf += '<span class="col typecol">';
		buf += Dex.getTypeIcon(type.name);
		buf += '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		buf += '</a></li>';

		return buf;
	};
	Search.prototype.renderCategoryRow = function (category, matchStart, matchLength, errorMessage) {
		var attrs = '';
		if (Search.urlRoot) attrs = ' href="' + Search.urlRoot + 'categories/' + category.id + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="category|' + BattleLog.escapeHTML(category.name) + '">';

		// name
		var name = category.name;
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		buf += '<span class="col namecol">' + name + '</span> ';

		// category
		buf += '<span class="col typecol">' + Dex.getCategoryIcon(category.name) + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		buf += '</a></li>';

		return buf;
	};
	Search.prototype.renderArticleRow = function (article, matchStart, matchLength, errorMessage) {
		var attrs = '';
		if (Search.urlRoot) attrs = ' href="' + Search.urlRoot + 'articles/' + article.id + '" data-target="push"';
		var isSearchType = (article.id === 'pokemon' || article.id === 'moves');
		if (isSearchType) attrs = ' href="' + article.id + '/" data-target="replace"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="article|' + BattleLog.escapeHTML(article.name) + '">';

		// name
		var name = article.name;
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		buf += '<span class="col namecol">' + name + '</span> ';

		// article
		if (isSearchType) {
			buf += '<span class="col movedesccol">(search type)</span> ';
		} else {
			buf += '<span class="col movedesccol">(article)</span> ';
		}

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		buf += '</a></li>';

		return buf;
	};
	Search.prototype.renderEggGroupRow = function (egggroup, matchStart, matchLength, errorMessage) {
		var attrs = '';
		if (Search.urlRoot) attrs = ' href="' + Search.urlRoot + 'egggroups/' + toID(egggroup.name) + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="egggroup|' + BattleLog.escapeHTML(egggroup.name) + '">';

		// name
		var name = egggroup.name;
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		buf += '<span class="col namecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		buf += '</a></li>';

		return buf;
	};
	Search.prototype.renderTierRow = function (tier, matchStart, matchLength, errorMessage) {
		var attrs = '';
		if (Search.urlRoot) attrs = ' href="' + Search.urlRoot + 'tiers/' + toID(tier.name) + '" data-target="push"';
		var buf = '<li class="result"><a' + attrs + ' data-entry="tier|' + BattleLog.escapeHTML(tier.name) + '">';

		// name
		var name = tier.name;
		if (matchLength) {
			name = name.substr(0, matchStart) + '<b>' + name.substr(matchStart, matchLength) + '</b>' + name.substr(matchStart + matchLength);
		}
		buf += '<span class="col namecol">' + name + '</span> ';

		// error
		if (errorMessage) {
			buf += errorMessage + '</a></li>';
			return buf;
		}

		buf += '</a></li>';

		return buf;
	};

	Search.gen = 9;
	Search.renderRow = Search.prototype.renderRow;
	Search.renderPokemonRow = Search.prototype.renderPokemonRow;
	Search.renderTaggedPokemonRowInner = Search.prototype.renderTaggedPokemonRowInner;
	Search.renderItemRow = Search.prototype.renderItemRow;
	Search.renderAbilityRow = Search.prototype.renderAbilityRow;
	Search.renderMoveRow = Search.prototype.renderMoveRow;
	Search.renderMoveRowInner = Search.prototype.renderMoveRowInner;
	Search.renderTaggedMoveRow = Search.prototype.renderTaggedMoveRow;
	Search.renderTypeRow = Search.prototype.renderTypeRow;
	Search.renderCategoryRow = Search.prototype.renderCategoryRow;
	Search.renderEggGroupRow = Search.prototype.renderEggGroupRow;
	Search.renderTierRow = Search.prototype.renderTierRow;

	exports.BattleSearch = Search;

})(window, jQuery);
