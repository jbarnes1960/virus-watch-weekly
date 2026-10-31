/**
 * Virus Watch Weekly — subscribe / unsubscribe form handler
 * Works when served via scripts/subscribe_server.py (POST /api/subscribe).
 * On the public site (any host other than localhost/127.0.0.1) the form opens a
 * pre-filled email to James instead, since there is no server API there.
 * Also powers the expandable stories (expand/collapse all, #story-N deep links, print).
 */
(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function showMsg(el, type, text) {
    if (!el) return;
    el.className = "msg visible " + type;
    el.textContent = text;
  }

  function hideMsg(el) {
    if (!el) return;
    el.className = "msg";
    el.textContent = "";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  var CONTACT = "jbarnes@nexalending.com";

  function hasLocalServer() {
    var h = window.location.hostname;
    return window.location.protocol !== "file:" && (h === "127.0.0.1" || h === "localhost");
  }

  function openMailto(kind, email, name) {
    var word = kind === "unsubscribe" ? "UNSUBSCRIBE" : "SUBSCRIBE";
    var body = word + " Virus Watch Weekly\n\nEmail: " + email + (name ? "\nName: " + name : "") + "\n";
    window.location.href =
      "mailto:" + CONTACT + "?subject=" + encodeURIComponent(word) + "&body=" + encodeURIComponent(body);
  }

  function apiBase() {
    // Relative URL so it works when served from the local helper on any host/port
    return "/api";
  }

  async function postSubscribe(email, name) {
    const res = await fetch(apiBase() + "/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email, name: name || "" }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error || data.message || "Subscribe failed (" + res.status + ")");
    }
    return data;
  }

  async function getUnsubscribe(email) {
    const res = await fetch(
      apiBase() + "/unsubscribe?email=" + encodeURIComponent(email),
      { method: "GET", headers: { Accept: "application/json" } }
    );
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error || data.message || "Unsubscribe failed (" + res.status + ")");
    }
    return data;
  }

  function wireForm() {
    const form = $("#subscribe-form");
    const msg = $("#form-message");
    const emailInput = $("#email") || $("#sub-email");
    const nameInput = $("#name") || $("#sub-name");
    const unsubBtn = $("#unsubscribe-btn");

    if (!form) return;

    // Prefill from query string (footer unsubscribe links)
    const action = (getQueryParam("action") || "").toLowerCase();
    const prefillEmail = getQueryParam("email");
    if (prefillEmail && emailInput) {
      emailInput.value = prefillEmail;
    }

    if (action === "unsubscribe" && prefillEmail) {
      showMsg(
        msg,
        "info",
        "Confirm unsubscribe for " + prefillEmail + " by clicking Unsubscribe below."
      );
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      hideMsg(msg);

      const email = (emailInput && emailInput.value || "").trim().toLowerCase();
      const name = (nameInput && nameInput.value || "").trim();

      if (!email) {
        showMsg(msg, "error", "Email is required.");
        return;
      }
      if (!isValidEmail(email)) {
        showMsg(msg, "error", "Please enter a valid email address.");
        return;
      }

      if (!hasLocalServer()) {
        openMailto("subscribe", email, name);
        showMsg(
          msg,
          "info",
          "Your email app should open with a pre-filled SUBSCRIBE message to " + CONTACT +
            ". Just hit send. (Nothing opened? Email " + CONTACT + " with the subject SUBSCRIBE.)"
        );
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const data = await postSubscribe(email, name);
        showMsg(
          msg,
          "success",
          data.message || "You're subscribed to Virus Watch Weekly. Welcome aboard."
        );
        form.reset();
        if (prefillEmail && emailInput) emailInput.value = "";
      } catch (err) {
        const offline =
          err && (err.name === "TypeError" || /Failed to fetch|NetworkError/i.test(String(err)));
        if (offline || window.location.protocol === "file:") {
          showMsg(
            msg,
            "error",
            "Live subscribe needs the local server. Run: bash scripts/ensure_server.sh then open http://127.0.0.1:8765/subscribe.html"
          );
        } else {
          showMsg(msg, "error", (err && err.message) || "Something went wrong. Please try again.");
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    if (unsubBtn) {
      unsubBtn.addEventListener("click", async function () {
        hideMsg(msg);
        const email = (emailInput && emailInput.value || "").trim().toLowerCase();
        if (!email) {
          showMsg(msg, "error", "Enter the email to unsubscribe.");
          return;
        }
        if (!isValidEmail(email)) {
          showMsg(msg, "error", "Please enter a valid email address.");
          return;
        }
        if (!hasLocalServer()) {
          openMailto("unsubscribe", email, "");
          showMsg(
            msg,
            "info",
            "Your email app should open with a pre-filled UNSUBSCRIBE message to " + CONTACT +
              ". Just hit send. (Nothing opened? Email " + CONTACT + " with the subject UNSUBSCRIBE.)"
          );
          return;
        }
        unsubBtn.disabled = true;
        try {
          const data = await getUnsubscribe(email);
          showMsg(msg, "success", data.message || "You have been unsubscribed.");
        } catch (err) {
          const offline =
            err && (err.name === "TypeError" || /Failed to fetch|NetworkError/i.test(String(err)));
          if (offline || window.location.protocol === "file:") {
            showMsg(
              msg,
              "error",
              "Live unsubscribe needs the local server. Run: bash scripts/ensure_server.sh then open http://127.0.0.1:8765/subscribe.html"
            );
          } else {
            showMsg(msg, "error", (err && err.message) || "Unsubscribe failed.");
          }
        } finally {
          unsubBtn.disabled = false;
        }
      });
    }
  }

  function wireStories() {
    var stories = document.querySelectorAll("details.story");
    if (!stories.length) return;

    var holder = document.querySelector(".stories-controls");
    if (holder && stories.length > 1) {
      [["Expand all", true], ["Collapse all", false]].forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = c[0];
        b.addEventListener("click", function () {
          stories.forEach(function (d) { d.open = c[1]; });
        });
        holder.appendChild(b);
      });
    }

    function openFromHash() {
      var id = (window.location.hash || "").slice(1);
      if (!id) return;
      var el = document.getElementById(id);
      if (el && el.tagName === "DETAILS") {
        el.open = true;
        el.scrollIntoView();
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);

    // Print / save-as-PDF: show every story open, then restore.
    var was = [];
    window.addEventListener("beforeprint", function () {
      was = [];
      stories.forEach(function (d) { was.push(d.open); d.open = true; });
    });
    window.addEventListener("afterprint", function () {
      stories.forEach(function (d, i) { d.open = was[i]; });
    });
  }

  function init() {
    wireForm();
    wireStories();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
