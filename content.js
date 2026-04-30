
async function main() {
  if (!location.href.includes("://connect.garmin.com/app/course/")) return;
  console.log("Running extension logic on:", location.href);
  function loadPaceBandDialog(){
    const existing = document.getElementById("paceband-sender-panel");
    if (existing) existing.remove();

    let hiddenCsrfToken = "";
    let courseId = 0;

    function getCsrfFromMeta() {
      const el = document.querySelector('meta[name="csrf-token"]');
      return (el && el.getAttribute("content") || "").trim();
    }

    function resolveCsrfToken() {
      return hiddenCsrfToken || getCsrfFromMeta();
    }

    const panel = document.createElement("div");
    panel.id = "paceband-sender-panel";
    panel.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:999999",
      "width:380px",
      "max-height:80vh",
      "overflow:auto",
      "background:#fff",
      "border:1px solid #ccc",
      "border-radius:10px",
      "box-shadow:0 10px 24px rgba(0,0,0,.2)",
      "padding:12px",
      "font:13px/1.4 Segoe UI,Arial,sans-serif"
    ].join(";");

    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        "<strong>Pacepro Sender</strong>" +
        "<div style='display:flex;gap:4px;'>" +
          '<button id="pbs-create" style="border:1px solid #ccc;background:#eee;border-radius:6px;padding:2px 8px;cursor:pointer;">Create custom PacePro</button>' +
          '<button id="pbs-close" style="border:1px solid #ccc;background:#eee;border-radius:6px;padding:2px 8px;cursor:pointer;">x</button>' +
        "</div>" +
      "</div>" +
      "<label>Payload file (.json)</label>" +
      '<input id="pbs-file" type="file" accept=".json,application/json" style="margin:4px 0 8px 0;" />' +
      "<label>Payload preview</label>" +
      '<textarea id="pbs-payload" style="width:100%;height:130px;box-sizing:border-box;margin:4px 0 8px 0;padding:6px;"></textarea>' +
      '<button id="pbs-send" style="border:1px solid #ccc;background:#eee;border-radius:6px;padding:2px 8px;cursor:pointer">Send</button>' +
      '<pre id="pbs-out" style="display:none;white-space:pre-wrap;background:#f6f6f6;padding:8px;border-radius:6px;margin-top:8px;min-height:70px;">Ready</pre>';

    document.body.appendChild(panel);

    const fileInput = panel.querySelector("#pbs-file");
    const payloadArea = panel.querySelector("#pbs-payload");
    const out = panel.querySelector("#pbs-out");
    const endpointInput = panel.querySelector("#pbs-endpoint");

    function setOut(msg) {
      out.textContent = msg;
    }

    function getCourseId() {
      let id = 0;
      if (window.location.pathname.includes('/app/course/')) {
        const parts = window.location.pathname.split('/');
        id = parts[parts.length - 1] || 0;
        setOut("Extracted course ID from URL: " + id);
      }
      else {
        const el = document.getElementsByClassName("PaceProDistance_courseLink__vaFmG")[0].firstElementChild;
        id = el && el.getAttribute("aria-label").trim() || 0
        setOut("Extracted course ID: " + id);
      }
      courseId = id;
      return id;
    }

    const tokenFromMeta = getCsrfFromMeta();
    if (tokenFromMeta) {
      hiddenCsrfToken = tokenFromMeta;
      setOut("CSRF token detected from page meta.");
    } else {
      setOut("No CSRF token visible in page meta yet.");
    }

    fileInput.addEventListener("change", async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;

      const txt = await f.text();
      let data = JSON.parse(txt.trim());
      data["paceBandSummary"]["courseId"] = getCourseId();
      payloadArea.value = JSON.stringify(data);
      setOut("Loaded raw JSON payload.\nReplaced courseId with: " + courseId);
    });

    panel.querySelector("#pbs-create").addEventListener("click", async () => {
      window.open("https://gpx.maslowski.cz/", "_blank");
    });


    panel.querySelector("#pbs-send").addEventListener("click", async () => {
      const endpoint = "/gc-api/course-service/pacebands";
      const payload = payloadArea.value.trim();

      if (!payload) return setOut("Payload required.");

      try {
        JSON.parse(payload);
      } catch (e) {
        return setOut("Invalid JSON: " + e.message);
      }

      const csrf = resolveCsrfToken();
      if (!csrf) {
        return setOut("No CSRF token found. Ensure meta csrf-token exists on page or load HAR containing the token.");
      }

      setOut("Sending...");

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Connect-Csrf-Token": csrf
          },
          body: payload
        });

        const text = await res.text();
        if (res.ok) {
          json = JSON.parse(text);
          window.location.href = "/app/pacepro/edit/" + json["paceBandPk"];
        } else {
          setOut("Status: " + res.status + " " + res.statusText + "\n\n" + text);
        }
      } catch (e) {
        setOut("Request failed: " + (e && e.message ? e.message : String(e)) + text);
      }
    });

    panel.querySelector("#pbs-close").addEventListener("click", () => {
      panel.remove();
    });
  };

  if (document.getElementById("custom-pacepro-btn")) return;
  let footer = null;
  while (!footer) {
    await new Promise(resolve => setTimeout(resolve, 500));
    footer = document.querySelector(".CourseDetailsFooter_actionsContainerInner__97NBP");
  }
  if (footer) {
    const btn = document.createElement("button");
    btn.className = "Button_btn__g8LLk Button_secondary__8WBFj Button_small__waifo";
    btn.type = "button";
    btn.id = "custom-pacepro-btn";
    btn.textContent = "Load Custom PacePro";
    btn.addEventListener("click", loadPaceBandDialog);
    footer.insertBefore(btn, footer.children[2]);
  }

}
main();
console.log("PacePro Sender script loaded.");

let lastUrl = location.href;

// 🔁 1. Polling (guaranteed detection)
setInterval(() => {
  if (location.href !== lastUrl) {
    console.log("URL changed (poll):", lastUrl, "→", location.href);
    lastUrl = location.href;
    main();
  }
}, 500);

// 👀 2. MutationObserver (faster reaction)
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    console.log("URL changed (mutation):", lastUrl, "→", location.href);
    lastUrl = location.href;
    main();
  }
});

observer.observe(document, {
  subtree: true,
  childList: true
});