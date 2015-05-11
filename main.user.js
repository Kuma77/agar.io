// ==UserScript==
// @name         Agar.io connector.
// @version      0.3
// @description  Adds new features to Agar.io
// @match        http://agar.io/
// @grant        none
// ==/UserScript==

if (typeof jQuery === 'undefined') {
  function sleep(ms) {
    ms += new Date().getTime();
    while (new Date() < ms){}
  } 
  sleep(2500);
  if (typeof jQuery === 'undefined') {
    window.location = "http://agar.io/";
  }
}

(function (window, $) {
  if (window.location.hostname != "agar.io" && window.location.hostname != "localhost" && window.location.hostname != "10.10.2.13") {
    window.location = "http://agar.io/";
    return;
  }
  var VERSION = 1;
  var DOUBLE_BUFFER = false;
  var canvas, ctx;
  var realCanvas, realCtx;
  var canvasWidth, canvasHeight;
  var pointsQuad = null;
  var numCellsCreated = 0;
  var socket = null;
  var cameraX = 0;
  var cameraY = 0;
  var myIDs = [];
  var myCells = [];
  var cellById = {};
  var cells = [];
  var cellsDestroyed = [];
  var scoreboard = [];
  var isMouseDown = false;
  var mouseX = 0;
  var mouseY = 0;
  var mouseGameX = -1;
  var mouseGameY = -1;
  var frameNum = 0;
  var now = 0;
  var pendingNick = null;
  var INTERP_TIME = 120;
  var minX = 0;
  var minY = 0;
  var maxX = 10000;
  var maxY = 10000;
  var zoom = 1.0;
  var region = null;
  var skinsEnabled = true;
  var namesEnabled = true;
  var sizeEnabled = true;
  var showBorders = true;
  var sizeColors = true;
  var enableZooming = true;
  var restoreTime = true;
  var imageTransparency = false;
  var hardMode = false;
  var menuOpened = false;
  var justLostMyCell = false;
  var maximumMass = 0;
  var blackTheme = false;
  var incratio = 1.125;
  var lastsplit = -1;
  var zeta = [60, 97, 32, 116, 97, 114, 103, 101, 116, 61, 34, 95, 98, 108, 97, 110, 107, 34, 32, 104, 114, 101, 102, 61, 34, 104, 116, 116, 112, 58, 47, 47, 97, 103, 97, 114, 45, 105, 111, 46, 114, 117, 47, 101, 110, 47, 99, 104, 101, 97, 116, 45, 104, 97, 99, 107, 45, 109, 117, 108, 116, 105, 116, 111, 111, 108, 34, 62, 69, 120, 116, 101, 110, 115, 105, 111, 110, 32, 102, 101, 97, 116, 117, 114, 101, 115, 60, 47, 97, 62];
  var zetb = [60, 97, 32, 116, 97, 114, 103, 101, 116, 61, 34, 95, 98, 108, 97, 110, 107, 34, 32, 104, 114, 101, 102, 61, 34, 104, 116, 116, 112, 58, 47, 47, 97, 103, 97, 114, 45, 105, 111, 46, 114, 117, 47, 101, 110, 47, 100, 111, 110, 97, 116, 101, 45, 115, 107, 105, 110, 34, 62, 65, 100, 100, 32, 121, 111, 117, 114, 32, 111, 119, 110, 32, 115, 107, 105, 110, 60, 47, 97, 62];
  var isMobile = ('ontouchstart' in window) && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  var splitImg = new Image();
  splitImg.src = "img/split.png";

  function init() {
    createFormElements();

    refreshRegionInfo();
    setInterval(refreshRegionInfo, 60 * 1000);
    if (DOUBLE_BUFFER) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
      realCanvas = document.getElementById('canvas');
      realCtx = realCanvas.getContext('2d');
    } else {
      realCanvas = canvas = document.getElementById('canvas');
      realCtx = ctx = realCanvas.getContext('2d');
    }
    realCanvas.onmousedown = function (e) {
      if (isMobile) {
        var dx = (e.clientX - getSplitButtonCenter());
        var dy = (e.clientY - getSplitButtonCenter());
        if (Math.sqrt(dx * dx + dy * dy) <= getSplitButtonSize() / 2) {
          sendMitosis();
          return;
        }
      }
      mouseX = e.clientX;
      mouseY = e.clientY;
      isMouseDown = true;
      updateMouseGamePos();
      sendTargetUpdate();
    }
    realCanvas.onmousemove = function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      updateMouseGamePos();
    }
    realCanvas.onmouseup = function (e) {
      isMouseDown = false;
    }

    var spaceDown = false;
    var qDown = false;
    var wDown = false;
    window.onkeydown = function (e) {
      if (e.keyCode == 32 && !spaceDown) {
        sendMitosis();
        spaceDown = true;
      }
      if (e.keyCode == 81 && !qDown) {
        sendSpread();
        qDown = true;
      }
      if (e.keyCode == 87 && !wDown) {
        sendEject();
        wDown = true;
      }
      if (27 == e.keyCode && !menuOpened) {
        $("#overlays").fadeIn(200);
        menuOpened = true;
      } else if (27 == e.keyCode && menuOpened) {
        $("#overlays").fadeOut(200);
        menuOpened = false;
      }
    }
    window.onkeyup = function (e) {
      if (e.keyCode == 32) spaceDown = false;
      if (e.keyCode == 87) wDown = false;
      if (e.keyCode == 81 && qDown) {
        sendUnspread();
        qDown = false;
      }
    }
    window.onblur = function () {
      sendUnspread();
      spaceDown = false;
      qDown = false;
      wDown = false;
    }
    window.onresize = onResize;
    onResize();
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(drawLoop);
    } else {
      setInterval(draw, 1000 / 60);
    }
    setInterval(sendTargetUpdate, 100);
    setRegion($('#region').val());
  }

  function think() {
    var minX = Number.POSITIVE_INFINITY;
    var minY = Number.POSITIVE_INFINITY;
    var maxX = Number.NEGATIVE_INFINITY;
    var maxY = Number.NEGATIVE_INFINITY;
    var maxSize = 0;
    for (var i = 0; i < cells.length; i++) {
      maxSize = Math.max(cells[i].size, maxSize);
      minX = Math.min(cells[i].x, minX);
      minY = Math.min(cells[i].y, minY);
      maxX = Math.max(cells[i].x, maxX);
      maxY = Math.max(cells[i].y, maxY);
    }
    minX -= maxSize + 100;
    minY -= maxSize + 100;
    maxX += maxSize + 100;
    maxY += maxSize + 100;
    pointsQuad = QUAD.init({
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY
    });
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!c.shouldRender()) continue;
      for (var j = 0; j < c.points.length; ++j) {
        pointsQuad.insert(c.points[j]);
      }
    }
  }

  function gameX(x) {
    return (x - canvasWidth / 2) / zoom + cameraX;
  }

  function gameY(y) {
    return (y - canvasHeight / 2) / zoom + cameraY;
  }

  function updateMouseGamePos() {
    mouseGameX = gameX(mouseX);
    mouseGameY = gameY(mouseY);
  }
  var regionsNames = null;

  function refreshRegionInfo() {
    if (regionsNames == null) {
      regionsNames = {};
      $('#region').children().each(function () {
        var $v = $(this);
        var code = $v.val();
        if (!code) return;
        regionsNames[code] = $v.text();
      });
    }
    $.get("http://m.agar.io/info", function (obj) {
      for (var i in obj.regions) {
        $('#region option[value="' + i + '"]').text(regionsNames[i] + " (" + obj.regions[i].numPlayers + " players)");
      }
    }, "json");
  }
  window['setNick'] = function (str) {
    if ($("#srv-ip").val() && socket != null && socket.readyState == socket.OPEN) {
      connect("ws://" + $("#srv-ip").val());
    }
    $('#adsBottom').hide();
    pendingNick = str;
    sendNick();
    $('#overlays').hide();
    maximumMass = 0;
  }

  function setRegion(r) {
    if (!r) return;
    if (r == region) return;
    region = r;
    reconnect();
  }
  window['setRegion'] = setRegion;

  function showNickDialog() {
    $('#overlays').fadeIn(3000);
  }
  window['setSkins'] = function (v) {
    skinsEnabled = v;
  }
  window['setNames'] = function (v) {
    namesEnabled = v;
  }
  window['setDarkTheme'] = function (v) {
    blackTheme = v;
  }
  window['setColors'] = function (v) {
    hardMode = v;
  }
  window['setShowMass'] = function (v) {
    sizeEnabled = v;
  }

  function findServer() {
    $.ajax("http://m.agar.io/", {
      error: function () {
        setTimeout(findServer, 1000);
      },
      success: function (data) {
        var ips = data.split('\n');
        connect("ws://" + ips[0]);
      },
      dataType: "text",
      method: "POST",
      cache: false,
      crossDomain: true,
      data: region || "?"
    });
  }

  function reconnect() {
    $("#connecting").show();
    findServer();
  }
  window['connect'] = connect;

  function connect(ip) {
    if (socket) {
      socket['onopen'] = null;
      socket['onmessage'] = null;
      socket['onclose'] = null;
      socket.close();
      socket = null;
    }
    myIDs = [];
    myCells = [];
    cellById = {};
    cells = [];
    cellsDestroyed = [];
    scoreboard = [];
    console.log("Connecting to " + ip);

    updateMenuAddress(ip);

    socket = new WebSocket(ip);
    socket.binaryType = "arraybuffer";
    socket['onopen'] = onSocketOpen;
    socket['onmessage'] = onSocketMessage;
    socket['onclose'] = onSocketClose;
    socket['onerror'] = function () {
      console.log("socket error");
    }
  };

  function onSocketOpen(e) {
    $('#connecting').hide();
    console.log("socket open");
    var buf = new ArrayBuffer(5);
    var view = new DataView(buf);
    view.setUint8(0, 0xFF);
    view.setUint32(1, VERSION, true);
    socket.send(buf);
    sendNick();
  }

  function onSocketClose(e) {
    console.log("socket close");
    setTimeout(reconnect, 500);
  }

  function onSocketMessage(e) {
    var offset = 1;

    function parseString() {
      var name = "";
      for (;;) {
        var v = view.getUint16(offset, true);
        offset += 2;
        if (v == 0) break;
        name += String.fromCharCode(v);
      }
      return name;
    }
    var view = new DataView(e.data);
    switch (view.getUint8(0)) {
    case 0x10:
      parseUpdate(view);
      break;
    case 0x14:
      myCells = [];
      myIDs = [];
      break;
    case 0x20:
      myIDs.push(view.getUint32(1, true));
      break;
    case 0x30:
      scoreboard = [];
      while (offset < view.byteLength) {
        scoreboard.push(parseString());
      }
      preRenderScoreboard();
      break;
    case 0x31:
      a = view.getUint32(offset, true);
      offset += 4;
      scoreboard = [];
      var b = 0;
      for (;a > b;++b) {
        var id = view.getUint32(offset, true);
        offset += 4;
        scoreboard.push({
          id : id,
          name : parseString()
        });
      }
      preRenderScoreboard();
    break;
    case 0x40:
      minX = view.getFloat64(1, true);
      minY = view.getFloat64(9, true);
      maxX = view.getFloat64(17, true);
      maxY = view.getFloat64(25, true);
      if (myCells.length == 0) {
        cameraX = (maxX + minX) / 2;
        cameraY = (maxY + minY) / 2;
      }
      break;
    }
  }

  function parseUpdate(view) {
    now = +new Date();
    var code = Math.random();
    var offset = 1;
    justLostMyCell = false;

    function parseString() {
      var name = "";
      for (;;) {
        var v = view.getUint16(offset, true);
        offset += 2;
        if (v == 0) break;
        name += String.fromCharCode(v);
      }
      return name;
    }
    var numKills = view.getUint16(offset, true);
    offset += 2;
    for (var i = 0; i < numKills; ++i) {
      var attacker = cellById[view.getUint32(offset, true)];
      var victim = cellById[view.getUint32(offset + 4, true)];
      offset += 8;
      if (!attacker || !victim) continue;
      victim.destroy();
      victim.ox = victim.x;
      victim.oy = victim.y;
      victim.oSize = victim.size;
      victim.nx = attacker.x;
      victim.ny = attacker.y;
      victim.nSize = victim.size;
      victim.updateTime = now;
    }
    for (;;) {
      var id = view.getUint32(offset, true);
      offset += 4;
      if (id == 0) break;
      var x = view.getFloat64(offset, true);
      offset += 8;
      var y = view.getFloat64(offset, true);
      offset += 8;
      var size = view.getFloat64(offset, true);
      offset += 8;
      var colorCode = view.getUint8(offset++);
      var color, isVirus = false;
      if (colorCode == 0) {
        isVirus = true;
        color = '#33FF33';
      } else if (colorCode == 255) {
        var r = view.getUint8(offset++);
        var g = view.getUint8(offset++);
        var b = view.getUint8(offset++);
        color = RGBtoStyle((r << 16) | (g << 8) | b);
        var flags = view.getUint8(offset++);
        isVirus = !!(flags & 1);
      } else {
        color = RGBtoStyle(HSVtoRGB(0x00F7FF | (colorCode << 16)));
      }
      var name = parseString();
      var cell = null;
      if (!cellById.hasOwnProperty(id)) {
        cell = new Cell(id, x, y, size, color, isVirus, name);
      } else {
        cell = cellById[id];
        cell.updatePos();
        cell.ox = cell.x;
        cell.oy = cell.y;
        cell.oSize = cell.size;
        cell.color = color;
      }
      cell.nx = x;
      cell.ny = y;
      cell.nSize = size;
      cell.updateCode = code;
      cell.updateTime = now;
      if (myIDs.indexOf(id) != -1) {
        if (myCells.indexOf(cell) == -1) {
          document.getElementById('overlays').style.display = 'none';
          myCells.push(cell);
          if (myCells.length == 1) {
            cameraX = cell.x;
            cameraY = cell.y;
          }
        }
      }
    }
    view.getUint16(offset, true);
    offset += 2;
    var numClean = view.getUint32(offset, true);
    offset += 4;
    for (var i = 0; i < numClean; i++) {
      var id = view.getUint32(offset, true);
      offset += 4;
      if (cellById[id]) {
        cellById[id].updateCode = code;
      }
    }
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].updateCode != code) cells[i--].destroy();
    }
    if (justLostMyCell && myCells.length == 0) {
      showNickDialog();
    }
  }
  var lastTargetUpdateX = -1;
  var lastTargetUpdateY = -1;

  function sendTargetUpdate() {
    if (socket == null || socket.readyState != socket.OPEN) return;
    if (lastTargetUpdateX == mouseGameX && lastTargetUpdateY == mouseGameY) return;
    lastTargetUpdateX = mouseGameX;
    lastTargetUpdateY = mouseGameY;
    var buf = new ArrayBuffer(1 + 8 + 8 + 4);
    var view = new DataView(buf);
    view.setUint8(0, 0x10);
    view.setFloat64(1, mouseGameX, true);
    view.setFloat64(9, mouseGameY, true);
    view.setUint32(17, 0, true);
    socket.send(buf);
  }

  function sendNick() {
    if (socket == null || socket.readyState != socket.OPEN) return;
    if (pendingNick == null) return;
    var buf = new ArrayBuffer(1 + pendingNick.length * 2);
    var view = new DataView(buf);
    view.setUint8(0, 0x00);
    for (var i = 0; i < pendingNick.length; ++i) {
      view.setUint16(1 + i * 2, pendingNick.charCodeAt(i), true);
    }
    socket.send(buf);
  }

  function sendMitosis() {
    sendTargetUpdate();
    sendSingleByte(0x11);
    lastsplit = Date.now();
  }

  function sendSpread() {
    sendSingleByte(0x12);
  }

  function sendUnspread() {
    sendSingleByte(0x13);
  }

  function sendEject() {
    sendTargetUpdate();
    sendSingleByte(0x15);
  }

  function sendSingleByte(b) {
    if (socket == null || socket.readyState != socket.OPEN) return;
    var buf = new ArrayBuffer(1);
    var view = new DataView(buf);
    view.setUint8(0, b);
    socket.send(buf);
  }
  var renderedScoreboard = null;
  var detail = 1.0;

  function drawLoop() {
    draw();
    window.requestAnimationFrame(drawLoop);
  }

  function onResize() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = realCanvas.width = canvasWidth;
    canvas.height = realCanvas.height = canvasHeight;
    draw();
  }

  function calculateZoom() {
    if (!enableZooming) {
      var totalSize = 0.0;
      for (var i = 0; i < myCells.length; i++) {
        totalSize += myCells[i].size;
      }
      var f = Math.pow(Math.min(64.0 / totalSize, 1.0), 1.0 / 2.5);
      var d = f * Math.max(canvasHeight / 965, canvasWidth / 1920);
      zoom = (9 * zoom + d) / 10.0;
    }
  }

  function draw() {
    var start = +new Date();
    ++frameNum;
    calculateZoom();
    now = +new Date();
    think();
    if (myCells.length > 0) {
      var avgX = 0,
        avgY = 0;
      for (var i = 0; i < myCells.length; i++) {
        myCells[i].updatePos();
        avgX += myCells[i].x / myCells.length;
        avgY += myCells[i].y / myCells.length;
      }
      cameraX = (cameraX + avgX) / 2;
      cameraY = (cameraY + avgY) / 2;
    }
    updateMouseGamePos();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = blackTheme ? '#111111' : '#F2FBFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.strokeStyle = blackTheme ? '#AAAAAA' : '#000000';
    ctx.globalAlpha = 0.2;
    ctx.scale(zoom, zoom);
    var w = canvasWidth / zoom,
      h = canvasHeight / zoom;
    for (var x = -0.5 + (-cameraX + w / 2) % 50; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (var y = -0.5 + (-cameraY + h / 2) % 50; y < h; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
    cells.sort(function (a, b) {
      if (a.size == b.size) {
        return a.id - b.id;
      }
      return a.size - b.size;
    })
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, -cameraY);
    if (showBorders) {
      drawMapBorders();
    }
    for (var i = 0; i < cellsDestroyed.length; i++) {
      cellsDestroyed[i].draw();
    }
    for (var i = 0; i < cells.length; i++) {
      cells[i].draw();
    }
    ctx.restore();
    if (renderedScoreboard && scoreboard.length != 0) {
      ctx.drawImage(renderedScoreboard, canvasWidth - renderedScoreboard.width - 10, 10);
    }
    maximumMass = Math.max(maximumMass, getTotalMass());
    if (maximumMass != 0) {
      var txt = "Score: " + ~~(maximumMass / 100) + " X: " + ~~cameraX + " Y: " + ~~cameraY;
      ctx.font = "24px Ubuntu";
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = 0.2;
      var w = ctx.measureText(txt).width;
      ctx.fillRect(canvasWidth / 2 - w / 2 - 5, canvasHeight - 10 - 24 - 10, w + 10, 34);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(txt, canvasWidth / 2 - w / 2, canvasHeight - 10 - 8);
    }
    renderSplitButton();
    if (DOUBLE_BUFFER) {
      realCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      realCtx.drawImage(canvas, 0, 0);
    }
    var end = +new Date();
    var renderDuration = end - start;
    if (renderDuration > 1000 / 60) {
      detail -= 0.01;
    } else if (renderDuration < 1000 / 65) {
      detail += 0.01;
    }
    if (detail < 0.4) detail = 0.4;
    if (detail > 1.0) detail = 1.0;
  }

  function getSplitButtonSize() {
    return canvasWidth / 5;
  }

  function getSplitButtonCenter() {
    return 5 + getSplitButtonSize() / 2;
  }

  function renderSplitButton() {
    if (!isMobile) return;
    if (!splitImg.width) return;
    var s = getSplitButtonSize();
    ctx.drawImage(splitImg, 5, 5, s, s);
  }

  function getTotalMass() {
    var c = 0;
    for (var i = 0; i < myCells.length; i++) {
      c += myCells[i].nSize * myCells[i].nSize;
    }
    return c;
  }

  function getTextHeight(n) {
    return ~~((n * canvasHeight / 965) * 1.4);
  }

  function getTextFont(n) {
    return ~~(n * canvas.height / 965) + "pt sans-serif";
  }

  function drawMapBorders() {
    if (blackTheme) {
      ctx.strokeStyle = '#FFFFFF';
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(11180, 0);
    ctx.lineTo(11180, 11180);
    ctx.lineTo(0, 11180);
    ctx.lineTo(0, 0);
    ctx.stroke();
  }

  function preRenderScoreboard() {
    if (scoreboard.length == 0) return;
    renderedScoreboard = document.createElement('canvas');
    var nctx = renderedScoreboard.getContext('2d');
    var w = 200;
    var h = 20 + 40 + 24 * scoreboard.length;
    var s = Math.min(200, canvasWidth * 0.3) / 200;
    renderedScoreboard.width = w * s;
    renderedScoreboard.height = h * s;
    nctx.scale(s, s);
    nctx.globalAlpha = 0.4;
    nctx.fillStyle = '#000000';
    nctx.fillRect(0, 0, w, h);
    nctx.globalAlpha = 1.0;
    nctx.fillStyle = '#FFFFFF';
    var txt = null;
    txt = "Leaderboard";
    nctx.font = "30px Ubuntu";
    nctx.fillText(txt, w / 2 - nctx.measureText(txt).width / 2, 40);
    nctx.font = "20px Ubuntu";
    for (var i = 0; i < scoreboard.length; ++i) {
      var name = scoreboard[i].name || "An unnamed cell";
      if (!namesEnabled) {
        if (myCells.length == 0 || myCells[0].name != name) {
          name = "An unnamed cell";
        }
      }
      if (myIDs.indexOf(scoreboard[i].id) != -1) {
          if (myCells[0].name) {
            name = myCells[0].name;
          }
          ctx.fillStyle = "#FFAAAA";
        } else {
          ctx.fillStyle = "#FFFFFF";
      }
      txt = (i + 1) + ". " + name;
      nctx.fillText(txt, w / 2 - nctx.measureText(txt).width / 2, 70 + i * 24);
    }
  }
  var skins = {};
  var skinsNames = "poland;usa;china;russia;canada;australia;spain;brazil;germany;ukraine;france;sweden;hitler;north korea;south korea;japan;united kingdom;earth;greece;latvia;lithuania;estonia;finland;norway;cia;maldivas;austria;nigeria;reddit;yaranaika;confederate;9gag;indiana;4chan;italy;ussr;pewdiepie;bulgaria;tumblr;2ch.hk;hong kong;portugal;jamaica;german empire;mexico;sanik;switzerland;croatia;chile;indonesia;bangladesh;thailand;iran;iraq;peru;moon;botswana;bosnia;netherlands;european union;taiwan;pakistan;hungary;satanist;qing dynasty;nazi;matriarchy;patriarchy;feminism;ireland;texas;facepunch;prodota;cambodia;steam;piccolo;ea;india;kc;denmark;quebec;ayy lmao;sealand;bait;tsarist russia;origin;vinesauce;stalin;belgium;luxembourg;stussy;prussia;8ch;argentina;scotland;sir;romania;belarus;wojak;isis;doge;nasa;byzantium;imperial japan;kingdom of france;somalia;turkey;mars;pokerface".split(";");
  var skinsSpecial = [
    {name: "inlife", src: "https://dl.dropboxusercontent.com/u/28013196/avatar/mario.jpeg"},
    {name: "vendetta", src: "https://dl.dropboxusercontent.com/u/28013196/avatar/anon.jpg"},
    {name: "=Ð²Ñ‹ÐµÐ±Ñƒ=", src: "https://dl.dropboxusercontent.com/u/28013196/avatar/misha.jpg"},
    {name: "id157319246", src: "https://dl.dropboxusercontent.com/u/28013196/avatar/id157319246.jpg"},
    {name: "pikabu", src: "https://dl.dropboxusercontent.com/u/28013196/avatar/pikabu.jpg"},
    {name: "Ð¿Ð¸ÐºÐ°Ð±Ñƒ", src: "https://dl.dropboxusercontent.com/u/28013196/avatar/pikabu.jpg"},
    {name: ":3", src: "https://dl.dropboxusercontent.com/u/28013196/avatar/ks.jpg"},
    {name: "pkb", src: "https://dl.dropboxusercontent.com/u/28013196/avatar/pikabu.jpg"},
    {name: "qgs", src: "http://static-cdn.jtvnw.net/jtv_user_pictures/quinckgaming-profile_image-1274c7af81136da9-150x150.png"}
  ];

  function hasSkin(str) {
    return (skinsNames.indexOf(str) != -1);
  }
  
  function isSpecialSkin(str) {
    return (getSpecialSkin(str) != null);
  }

  function getSpecialSkin(str) {
    for (var i = 0; i < skinsSpecial.length; i++) {
      if (str.indexOf(skinsSpecial[i].name) != -1) {
        return skinsSpecial[i];
      }
    }
    return null;
  }

  function getSkin(str) {
    if (hardMode) return null;
    str = str.toLowerCase();
    if (!hasSkin(str) && !isSpecialSkin(str)) return null;
    if (!skins.hasOwnProperty(str)) {
      skins[str] = new Image();
      if (isSpecialSkin(str)) {
        skins[str].src = getSpecialSkin(str).src;
      } else {
        skins[str].src = "skins/" + str + ".png";
      }
    }
    return skins[str];
  }

  function Cell(id, x, y, size, color, isVirus, name) {
    cells.push(this);
    cellById[id] = this;
    this.id = id;
    this.ox = this.x = x;
    this.oy = this.y = y;
    this.oSize = this.size = size;
    this.color = color;
    this.isVirus = isVirus;
    this.points = [];
    this.pointsAcc = [];
    this.createPoints();
    this.setName(name);
  }
  Cell.prototype = {
    id: 0,
    points: null,
    pointsAcc: null,
    name: null,
    cachedName: null,
    cachedSize: null,
    cachedTime: null,
    x: 0,
    y: 0,
    size: 0,
    ox: 0,
    oy: 0,
    oSize: 0,
    nx: 0,
    ny: 0,
    nSize: 0,
    updateTime: 0,
    updateCode: 0,
    drawTime: 0,
    destroyed: false,
    isVirus: false,
    destroy: function () {
      var i;
      for (i = 0; i < cells.length; i++) {
        if (cells[i] == this) {
          cells.splice(i, 1);
          break;
        }
      }
      delete cellById[this.id];
      i = myCells.indexOf(this);
      if (i != -1) {
        justLostMyCell = true;
        myCells.splice(i, 1);
      }
      i = myIDs.indexOf(this.id);
      if (i != -1) myIDs.splice(i, 1);
      this.destroyed = true;
      cellsDestroyed.push(this);
    },
    getNameSize: function () {
      return Math.max(~~(this.size * 0.3), 24);
    },
    setName: function (name) {
      this.name = name;
      if (!this.name) return;
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var h = this.getNameSize();
      var fontName = "Ubuntu";
      var font = (h - 2) + "px " + fontName;
      ctx.font = font;
      var w = ctx.measureText(name).width;
      var margin = 3;
      var vmargin = ~~(h * 0.2)
      canvas.width = w + margin * 2;
      canvas.height = h + vmargin;
      ctx.font = font;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeText(name, margin, h - vmargin / 2);
      ctx.fillText(name, margin, h - vmargin / 2);
      this.cachedName = canvas;
    },
    createPoints: function () {
      var numPoints = this.getNumPoints();
      while (this.points.length > numPoints) {
        var i = ~~(Math.random() * this.points.length);
        this.points.splice(i, 1);
        this.pointsAcc.splice(i, 1);
      }
      if (this.points.length == 0 && numPoints > 0) {
        this.points.push({
          c: this,
          v: this.size,
          x: this.x,
          y: this.y
        });
        this.pointsAcc.push(Math.random() - 0.5);
      }
      while (this.points.length < numPoints) {
        var i = ~~(Math.random() * this.points.length);
        var p = this.points[i];
        this.points.splice(i, 0, {
          c: this,
          v: p.v,
          x: p.x,
          y: p.y
        });
        this.pointsAcc.splice(i, 0, this.pointsAcc[i]);
      }
    },
    getNumPoints: function () {
      return ~~(Math.max(this.size * zoom * (this.isVirus ? Math.min(detail * 2, 1.0) : detail), this.isVirus ? 10 : 5));
    },
    movePoints: function () {
      this.createPoints();
      var points = this.points;
      var pointsAcc = this.pointsAcc;
      var oldAcc = pointsAcc.concat();
      var oldPoints = points.concat();
      var n = oldPoints.length;
      for (var i = 0; i < n; ++i) {
        var left = oldAcc[(i - 1 + n) % n];
        var right = oldAcc[(i + 1) % n];
        pointsAcc[i] += (Math.random() - 0.5);
        pointsAcc[i] *= 0.7;
        if (pointsAcc[i] > 10.0) pointsAcc[i] = 10.0;
        if (pointsAcc[i] < -10.0) pointsAcc[i] = -10.0;
        pointsAcc[i] = (left + right + pointsAcc[i] * 8) / 10;
      }
      var myCell = this;
      for (var i = 0; i < n; ++i) {
        var me = oldPoints[i].v;
        var left = oldPoints[(i - 1 + n) % n].v;
        var right = oldPoints[(i + 1) % n].v;
        if (this.size > 15) {
          var isTouching = false;
          var D = 5;
          var myX = points[i].x;
          var myY = points[i].y;
          pointsQuad.retrieve2(myX - D, myY - D, D * 2, D * 2, function (other) {
            if (other.c != myCell) {
              var dist = (myX - other.x) * (myX - other.x) + (myY - other.y) * (myY - other.y);
              if (dist < D * D) {
                isTouching = true;
              }
            }
          });
          if (!isTouching) {
            if (points[i].x < minX || points[i].y < minY || points[i].x > maxX || points[i].y > maxY) {
              isTouching = true;
            }
          }
          if (isTouching) {
            if (pointsAcc[i] > 0) {
              pointsAcc[i] = 0;
            }
            pointsAcc[i] -= 1.0;
          }
        }
        me += pointsAcc[i];
        if (me < 0) me = 0;
        me = (me * 12 + this.size) / 13;
        points[i].v = (left + right + me * 8) / 10;
        var d = Math.PI * 2 / n;
        var v = this.points[i].v;
        if (this.isVirus && i % 2 == 0) v += 5;
        points[i].x = this.x + Math.cos(d * i) * v;
        points[i].y = this.y + Math.sin(d * i) * v;
      }
    },
    updatePos: function () {
      var t = smoothStep(clamp((now - this.updateTime) / INTERP_TIME, 0.0, 1.0));
      var oldNameSize = this.getNameSize();
      if (this.destroyed && t >= 1.0) {
        var i = cellsDestroyed.indexOf(this);
        if (i != -1) cellsDestroyed.splice(i, 1);
      }
      this.x = t * (this.nx - this.ox) + this.ox;
      this.y = t * (this.ny - this.oy) + this.oy;
      this.size = t * (this.nSize - this.oSize) + this.oSize;
      if (!this.destroyed && oldNameSize != this.getNameSize()) {
        this.setName(this.name);
      }
      return t;
    },
    shouldRender: function () {
      if (this.x + this.size + 40 < cameraX - canvasWidth / 2 / zoom) return false;
      if (this.y + this.size + 40 < cameraY - canvasHeight / 2 / zoom) return false;
      if (this.x - this.size - 40 > cameraX + canvasWidth / 2 / zoom) return false;
      if (this.y - this.size - 40 > cameraY + canvasHeight / 2 / zoom) return false;
      return true;
    },
    getMass: function () {
      return (~~(this.size * this.size / 100));
    },
    draw: function () {
      if (sizeColors) {
        var mySize = Math.min.apply(null, myCells.map(function (x) { return x.getMass(); })); // Size of the smallest piece of us
        if (this.isVirus || myCells.length === 0) {
          this.color = "#666666"; // Viruses are always gray, and everything is gray when dead
        } else if (~myCells.indexOf(this)) {
          this.color = "#0000FF"; // Cells we own are blue
        } else if (this.getMass() > mySize * 2.5) {
          this.color = "#FF0000"; // Cells that can split on us are red
        } else if (this.getMass() > mySize * 1.25) {
          this.color = "#FF6600"; // Cells that can eat us are orange
        } else if (this.getMass() > mySize * 0.75) {
          this.color = "#FFFF00"; // Cells that we can't, and they can't eat us are yellow
        } else if (this.getMass() > mySize * 0.4) {
          this.color = "#007700"; // Cells that we can eat are dark green
        } else {
          this.color = "#00FF00"; // Cells that we can split on are ligth green
        }
      }
     
      if (!this.shouldRender()) return;
      ctx.save();
      this.drawTime = now;
      var t = this.updatePos();
      if (this.destroyed) {
        ctx.globalAlpha *= 1.0 - t;
      }
      this.movePoints();
      if (hardMode) {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#AAAAAA';
      } else {
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
      }
      ctx.beginPath();
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = this.isVirus ? 'mitter' : 'round';
      var numPoints = this.getNumPoints();
      for (var i = 0; i <= numPoints; ++i) {
        var j = i % numPoints;
        if (i == 0) {
          ctx.moveTo(this.points[j].x, this.points[j].y);
        } else {
          ctx.lineTo(this.points[j].x, this.points[j].y);
        }
      }
      ctx.closePath();
      var skin = skinsEnabled ? getSkin(this.name) : null;
      ctx.stroke();
      ctx.fill();
      if (skin != null && skin.width > 0) {
        ctx.save();
        ctx.clip();
        if (imageTransparency) {
          ctx.globalAlpha = 0.7;
        }
        ctx.drawImage(skin, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        ctx.restore();
      }
      if (hardMode || this.size > 15) {
        ctx.strokeStyle = '#000000';
        ctx.globalAlpha *= 0.1;
        ctx.stroke();
      }
      if ((namesEnabled || myCells.indexOf(this) != -1) && this.name && this.cachedName) {
        ctx.globalAlpha = 1.0;
        ctx.drawImage(this.cachedName, ~~this.x - ~~(this.cachedName.width / 2), ~~this.y - ~~(this.cachedName.height / 2));
      }
      if (sizeEnabled && ~~(this.size * this.size / 100) >= 10) {
        if (null == this.cachedSize) {
          this.cachedSize = new SVGPlotFunction(this.getNameSize() / 2, "#FFFFFF", true, "#000000");
        }
        this.cachedSize.setSize(this.getNameSize() / 2);
        this.cachedSize.setValue(~~(this.size * this.size / 100));
        i = this.cachedSize.render();
        ctx.globalAlpha = 1.0;
        ctx.drawImage(i, ~~this.x - ~~(i.width / 2), ~~this.y + ~~(this.size / 2) - ~~(i.height / 2));
      }

      // if (myCells.indexOf(this) != -1) {
      //   if (lastsplit != -1) {
      //     var curtime = ~~((Date.now() - lastsplit) / 1000);
      //     var needed = 32 * Math.pow(1.125, this.getMass() / 1000);
      //     if (~~(needed - curtime) <= 0) { lastsplit = -1; } 
      //     if (restoreTime) {
      //       if (null == this.cachedTime) {
      //         this.cachedTime = new SVGPlotFunction(this.getNameSize() / 2, "#FFFFFF", true, "#000000");
      //       }
      //       this.cachedTime.setSize(this.getNameSize() / 2);
      //       this.cachedTime.setValue(~~(needed - curtime));
      //       i = this.cachedTime.render();
      //       ctx.globalAlpha = 1.0;
      //       ctx.drawImage(i, ~~this.x - ~~(i.width / 2), ~~this.y - ~~(this.size / 2) - ~~(i.height / 2));
      //     }
      //   }
      // }
      ctx.restore();
    }
  };

  function RGBtoHSV(src) {
    var r = (src >> 16) & 0xFF;
    var g = (src >> 8) & 0xFF;
    var b = (src >> 0) & 0xFF;
    r /= 255.0;
    g /= 255.0;
    b /= 255.0;
    var min = Math.min(r, g, b);
    var max = Math.max(r, g, b);
    var h = 0;
    var s = 0;
    var v = max;
    var delta = max - min;
    if (max != 0) {
      s = delta / max;
      if (r == max) {
        h = (g - b) / delta;
      } else if (g == max) {
        h = 2 + (b - r) / delta;
      } else {
        h = 4 + (r - g) / delta;
      }
      h *= 60;
      if (h < 0) h += 360;
      h /= 360.0;
    }
    h = ~~(h * 0xFF) & 0xFF;
    s = ~~(s * 0xFF) & 0xFF;
    v = ~~(v * 0xFF) & 0xFF;
    return (h << 16) | (s << 8) | v;
  }

  function HSVtoRGB(src) {
    var h = ((src >> 16) & 0xFF) / 255.0 * 360.0;
    var s = ((src >> 8) & 0xFF) / 255.0;
    var v = ((src >> 0) & 0xFF) / 255.0;
    if (s == 0) {
      return (v << 16) | (v << 8) | (v << 0);
    }
    h /= 60;
    var i = ~~h;
    var f = h - i;
    var p = v * (1 - s);
    var q = v * (1 - s * f);
    var t = v * (1 - s * (1 - f));
    var r = 0;
    var g = 0;
    var b = 0;
    switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    }
    r = ~~(r * 0xFF) & 0xFF;
    g = ~~(g * 0xFF) & 0xFF;
    b = ~~(b * 0xFF) & 0xFF;
    return (r << 16) | (g << 8) | b;
  }

  function normalizeAngle(ang) {
    while (ang < -Math.PI) ang += Math.PI * 2;
    while (ang > Math.PI) ang -= Math.PI * 2;
    return ang;
  }

  function RGBtoStyle(c) {
    var str = c.toString(16);
    while (str.length < 6) str = "0" + str;
    return "#" + str;
  }

  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function smoothStep(x) {
    return x * x * (3 - 2 * x);
  }

  document.addEventListener("mousewheel", function (e) { 
    if (enableZooming) {
      zoom *= 1 + e.wheelDelta / 1000; 
    }
  }, false);

  function SVGPlotFunction(n, Var, stroke, plot) {
    if (n) {
      this._size = n;
    }
    if (Var) {
      this._color = Var;
    }
    this._stroke = !!stroke;
    if (plot) {
      this._strokeColor = plot;
    }
  }
  SVGPlotFunction.prototype = {
    _value : "",
    _color : "#000000",
    _stroke : false,
    _strokeColor : "#000000",
    _size : 16,
    _canvas : null,
    _ctx : null,
    _dirty : false,
    setSize : function(size) {
      if (this._size != size) {
        this._size = size;
        this._dirty = true;
      }
    },
    setColor : function(color) {
      if (this._color != color) {
        this._color = color;
        this._dirty = true;
      }
    },
    setStroke : function(stroke) {
      if (this._stroke != stroke) {
        this._stroke = stroke;
        this._dirty = true;
      }
    },
    setStrokeColor : function(b) {
      if (this._strokeColor != b) {
        this._strokeColor = b;
        this._dirty = true;
      }
    },
    setValue : function(value) {
      if (value != this._value) {
        this._value = value;
        this._dirty = true;
      }
    },
    render : function() {
      if (null == this._canvas && (this._canvas = document.createElement("canvas"), this._ctx = this._canvas.getContext("2d")), this._dirty) {
        var style = this._canvas;
        var ctx = this._ctx;
        var caracter = this._value;
        var size = this._size;
        var text = size + "px Ubuntu";
        ctx.font = text;
        var parentWidth = ctx.measureText(caracter).width;
        var PX = ~~(0.2 * size);
        style.width = parentWidth + 6;
        style.height = size + PX;
        ctx.font = text;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        ctx.strokeStyle = this._strokeColor;
        ctx.fillStyle = this._color;
        if (this._stroke) {
          ctx.strokeText(caracter, 3, size - PX / 2);
        }
        ctx.fillText(caracter, 3, size - PX / 2);
      }
      return this._canvas;
    }
  };

  function createFormElements () {

	var region = $( '#region' );

    if ( region.length ) {

        var ip = $( '' +
        	'<div class="form-group">' +
        		'<input id="srv-ip" class="form-control" placeholder="255.255.255.255:443" maxlength="20">' +
        		'</input>' +
        	'</div>'
        ).insertAfter( '#helloDialog > form > div:nth-child( 3 )' );

        $( '' +
        	'<div class="form-group">' +
        		'<button disabled type="button" id="connectBtn" class="btn btn-warning btn-needs-server" onclick="connect( "ws://" + $( "#srv-ip").val());" style="width: 100%">' +
        			'Connect' +
        		'</button>' +
        	'</div>'
        ).insertAfter( $( '#srv-ip' ).parent() );
    }
    $('.btn-needs-server').prop('disabled', false);
    $("#adsBottom").hide();
    $(".adsbygoogle").hide();
    $("center .text-muted").parent().append(  $(String.fromCharCode.apply(null, zeta) + "<br>"));
    $("center .text-muted").parent().append(  $(String.fromCharCode.apply(null, zetb) ));

    // [default settings]
    // show mass
    $("#settings div :last-child input").prop('checked', true);
    // show borders
    $("#settings div").append($('<label><input type="checkbox" onchange="setShowBorders($(this).is(\':checked\'));" checked> Show borders</label>'));
    // size colors
    $("#settings div").append($('<label><input type="checkbox" onchange="setSizeColors($(this).is(\':checked\'));" checked> Extended colors</label>'));
    // enable zoom
    $("#settings div").append($('<label><input type="checkbox" onchange="setZooming($(this).is(\':checked\'));" checked> Mousewheel zoom</label>'));
    // enable image transparency
    $("#settings div").append($('<label><input type="checkbox" onchange="setTranparent($(this).is(\':checked\'));"> 75% Skin transparency</label>'));


    // new global functions
    window['setShowBorders'] = function(value) {
      showBorders = value;
    };
    // new global functions
    window['setSizeColors'] = function(value) {
      sizeColors = value;
    };
    // new global functions
    window['setZooming'] = function(value) {
      enableZooming = value;
    };
    // new global functions
    window['setTranparent'] = function(value) {
      imageTransparency = value;
    };
  }

  function updateMenuAddress(ip) {
    $("#srv-ip").val(ip.split("//")[1] || ip);
  }

  window.onload = init;
})(window, jQuery);
