/**
 * Flawless embeddable chat widget.
 * Drop into any salon website with:
 *   <script src="https://YOUR_HOST/widget.js" data-flawless-api="https://YOUR_HOST"></script>
 * It renders a floating chat bubble that talks to POST /api/chat.
 */
(function () {
  var script = document.currentScript;
  var API = (script && script.getAttribute('data-flawless-api')) || '';
  var sessionId = 'web_' + Math.random().toString(36).slice(2) + Date.now();
  var location = null;

  var css = `
  .mz-bubble{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;
    background:linear-gradient(135deg,#c471ed,#f64f59);color:#fff;border:none;cursor:pointer;
    box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:26px;z-index:99999}
  .mz-panel{position:fixed;bottom:96px;right:24px;width:360px;max-width:calc(100vw - 32px);
    height:540px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;display:none;
    flex-direction:column;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.3);z-index:99999;
    font-family:-apple-system,Segoe UI,Roboto,sans-serif}
  .mz-panel.open{display:flex}
  .mz-head{background:linear-gradient(135deg,#c471ed,#f64f59);color:#fff;padding:14px 16px;font-weight:600}
  .mz-head small{display:block;font-weight:400;opacity:.9;font-size:12px}
  .mz-msgs{flex:1;overflow-y:auto;padding:14px;background:#faf7fc}
  .mz-msg{margin:6px 0;max-width:85%;padding:10px 12px;border-radius:14px;white-space:pre-wrap;
    font-size:14px;line-height:1.4;word-wrap:break-word}
  .mz-msg.bot{background:#fff;border:1px solid #eee;color:#222;border-bottom-left-radius:4px}
  .mz-msg.me{background:#c471ed;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
  .mz-card{background:#fff;border:1px solid #eee;border-radius:12px;padding:10px 12px;margin:6px 0;font-size:13px}
  .mz-card b{color:#8e2de2}
  .mz-card a{color:#f64f59;text-decoration:none}
  .mz-foot{display:flex;border-top:1px solid #eee;padding:8px;gap:8px}
  .mz-foot input{flex:1;border:1px solid #ddd;border-radius:20px;padding:10px 14px;font-size:14px;outline:none}
  .mz-foot button{background:#c471ed;color:#fff;border:none;border-radius:20px;padding:0 16px;cursor:pointer;font-weight:600}
  .mz-quick{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}
  .mz-quick button{background:#fff;border:1px solid #d9b8ec;color:#8e2de2;border-radius:16px;padding:6px 10px;font-size:12px;cursor:pointer}
  .mz-typing{font-size:12px;color:#999;padding:4px 14px}
  `;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var bubble = document.createElement('button');
  bubble.className = 'mz-bubble';
  bubble.innerHTML = '💇🏽‍♀️';
  bubble.setAttribute('aria-label', 'Open Flawless chat');

  var panel = document.createElement('div');
  panel.className = 'mz-panel';
  panel.innerHTML =
    '<div class="mz-head">Flawless Beauty Concierge<small>Salon & spa bookings, pricing & rides</small></div>' +
    '<div class="mz-msgs" id="mz-msgs"></div>' +
    '<div class="mz-quick" id="mz-quick"></div>' +
    '<div class="mz-typing" id="mz-typing" style="display:none">Flawless is typing…</div>' +
    '<div class="mz-foot"><input id="mz-input" placeholder="Ask about a hairdo, price, booking…"/><button id="mz-send">Send</button></div>';

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  var msgs = panel.querySelector('#mz-msgs');
  var input = panel.querySelector('#mz-input');
  var quick = panel.querySelector('#mz-quick');
  var typing = panel.querySelector('#mz-typing');

  function addMsg(text, who) {
    var el = document.createElement('div');
    el.className = 'mz-msg ' + who;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addCards(cards) {
    (cards || []).forEach(function (c) {
      if (c.type !== 'salon' && c.type !== 'transport') return;
      var el = document.createElement('div');
      el.className = 'mz-card';
      if (c.type === 'salon') {
        var dist = c.distanceKm != null ? ' · ' + c.distanceKm + ' km' : '';
        var mobile = c.offersMobile ? ' · 🏠 mobile +' + Math.round(c.mobileMarkup * 100) + '%' : '';
        el.innerHTML =
          '<b>' + c.name + '</b> ⭐ ' + c.rating + ' (' + c.reviewCount + ')' + dist + mobile +
          '<br>' + c.address +
          '<br>From ' + c.currency + ' ' + c.basePrice +
          ' · 🎓 ' + Math.round(c.studentDiscount * 100) + '% student · ⏰ ' + Math.round(c.prebookingDiscount * 100) + '% pre-book' +
          (c.topReview ? '<br><i>“' + c.topReview + '”</i>' : '');
      } else if (c.type === 'transport') {
        var p = c.plan;
        var lines = (p.options || []).map(function (o) {
          return '<a href="' + o.deepLink + '" target="_blank">' + o.partner + '</a> ' + Math.round(o.discount * 100) + '% off' + (o.coversLateReturn ? ' · covers late return' : '');
        }).join('<br>');
        el.innerHTML = '<b>Rides to ' + p.salonName + '</b><br>' + lines;
      }
      msgs.appendChild(el);
    });
    msgs.scrollTop = msgs.scrollHeight;
  }

  function setQuick(items) {
    quick.innerHTML = '';
    items.forEach(function (t) {
      var b = document.createElement('button');
      b.textContent = t;
      b.onclick = function () { send(t); };
      quick.appendChild(b);
    });
  }

  function send(text) {
    text = (text || input.value).trim();
    if (!text) return;
    addMsg(text, 'me');
    input.value = '';
    typing.style.display = 'block';
    fetch(API + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, message: text, location: location }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typing.style.display = 'none';
        addMsg(data.text || '…', 'bot');
        addCards(data.cards);
      })
      .catch(function () {
        typing.style.display = 'none';
        addMsg('Sorry, I had trouble connecting. Please try again.', 'bot');
      });
  }

  bubble.onclick = function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && !msgs.childNodes.length) {
      send('hi');
    }
  };
  panel.querySelector('#mz-send').onclick = function () { send(); };
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

  setQuick(['Knotless braids near me', 'Mobile silk press price', 'Student discount', 'Ride to salon']);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }, function () {}, { timeout: 4000 });
  }
})();
