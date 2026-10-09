import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { isTurnstileConfigured, renderTurnstile } from "../lib/turnstile";
import { AUTH_MSG } from "../lib/authErrors";

const widgetBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
  marginBottom: "14px",
};

const noticeStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "rgba(239, 68, 68, 0.15)",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  color: "#fca5a5",
  fontSize: "12px",
  padding: "10px 12px",
  borderRadius: "10px",
  textAlign: "left",
};

/**
 * Cloudflare Turnstile widget.
 *
 * Usage: `const captchaRef = useRef(null)` in the page, render
 * `<TurnstileWidget ref={captchaRef} />`, and at submit time read
 * `captchaRef.current.getToken()`. A missing or empty token must block the
 * request — the page owns that gate so no network call is made without one.
 *
 * `onTokenChange` is optional and only needed when the page wants to track
 * token state itself (expiry clears it to "").
 */
const TurnstileWidget = forwardRef(function TurnstileWidget({ onTokenChange }, ref) {
  const containerRef = useRef(null);
  const handleRef = useRef(null);
  const tokenCallback = useRef(onTokenChange);
  const [status, setStatus] = useState("loading");
  const [expired, setExpired] = useState(false);

  // Keep the latest callback without re-rendering the widget.
  useEffect(() => {
    tokenCallback.current = onTokenChange;
  }, [onTokenChange]);

  useImperativeHandle(
    ref,
    () => ({
      getToken: () => handleRef.current?.getToken() || "",
      reset: () => handleRef.current?.reset(),
    }),
    []
  );

  useEffect(() => {
    if (!isTurnstileConfigured()) {
      // Fail closed: the page must surface the configuration problem instead
      // of pretending a challenge was completed.
      setStatus("missing");
      tokenCallback.current?.("");
      return undefined;
    }

    let cancelled = false;

    renderTurnstile(containerRef.current, {
      onTokenChange: (value) => {
        // A fresh token means the user re-solved an expired challenge.
        if (value) setExpired(false);
        tokenCallback.current?.(value);
      },
      onExpired: () => setExpired(true),
    })
      .then((handle) => {
        if (cancelled) {
          handle.remove();
          return;
        }
        handleRef.current = handle;
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("failed");
        tokenCallback.current?.("");
      });

    return () => {
      cancelled = true;
      handleRef.current?.remove();
      handleRef.current = null;
    };
  }, []);

  return (
    <div style={widgetBox}>
      <div ref={containerRef} data-testid="turnstile-container" />
      {status === "missing" && <div style={noticeStyle}>{AUTH_MSG.captchaNotConfigured}</div>}
      {status === "failed" && <div style={noticeStyle}>{AUTH_MSG.captchaLoadFailed}</div>}
      {status === "ready" && expired && <div style={noticeStyle}>{AUTH_MSG.captchaExpired}</div>}
    </div>
  );
});

export default TurnstileWidget;
