import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import type { RoomRecord } from "../data/radio-runtime.ts";
import type { RadioIdentity } from "../middleware/access.ts";
import { routes } from "../routes.ts";
import { desktopColor, desktopThemeStyle } from "../ui/desktop/theme.ts";
import { desktopStyle } from "../ui/desktop/styles.ts";
import { Document } from "../ui/document.tsx";

export function LobbyPage(
  handle: Handle<{
    rooms: RoomRecord[];
    identity: RadioIdentity | null;
    selectedRoom: string;
    message?: string;
  }>,
) {
  return () => {
    let { rooms, identity, selectedRoom, message } = handle.props;
    return (
      <Document title="Radio stations">
        <main mix={[desktopThemeStyle, lobbyStyle.page]}>
          <section mix={[desktopStyle.window, lobbyStyle.window]}>
            <header mix={[desktopStyle.titleBar, lobbyStyle.titleBar]}>
              <span>radio</span>
              <span>{identity ? `signed in as ${identity.name}` : "tune in together"}</span>
            </header>

            <div mix={lobbyStyle.body}>
              <div>
                <p mix={lobbyStyle.eyebrow}>station directory</p>
                <h1 mix={lobbyStyle.heading}>Choose a room.</h1>
                <p mix={lobbyStyle.intro}>
                  Every station has its own queue and playback. Pick one, give us a name, and your
                  devices will meet there.
                </p>
              </div>

              {message ? (
                <p role="alert" mix={lobbyStyle.message}>
                  {message}
                </p>
              ) : null}

              <form method="post" action={routes.join.href()} mix={lobbyStyle.form}>
                <fieldset mix={lobbyStyle.rooms}>
                  <legend mix={lobbyStyle.legend}>available stations</legend>
                  {rooms.map((room) => (
                    <label
                      key={room.slug}
                      aria-label={`Join ${room.name}`}
                      mix={lobbyStyle.station}
                    >
                      <input
                        type="radio"
                        name="roomSlug"
                        value={room.slug}
                        checked={room.slug === selectedRoom}
                        required={true}
                      />
                      <span>
                        <strong>{room.name}</strong>
                        <small>/{room.slug}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <label mix={lobbyStyle.field}>
                  <span>your name</span>
                  <input
                    mix={desktopStyle.input}
                    name="name"
                    type="text"
                    autocomplete="name"
                    value={identity?.name ?? ""}
                    maxlength={40}
                    required={true}
                  />
                </label>
                {!identity ? (
                  <label mix={lobbyStyle.field}>
                    <span>radio password</span>
                    <input
                      mix={desktopStyle.input}
                      name="password"
                      type="password"
                      autocomplete="current-password"
                      maxlength={256}
                      required={true}
                    />
                  </label>
                ) : null}
                <button mix={desktopStyle.primaryButton} type="submit">
                  enter station
                </button>
              </form>

              {identity ? (
                <section mix={[desktopStyle.panel, lobbyStyle.createPanel]}>
                  <h2>make a station</h2>
                  <p>New stations stay in the directory and start with their own empty queue.</p>
                  <form
                    method="post"
                    action={routes.rooms.create.href()}
                    mix={lobbyStyle.createForm}
                  >
                    <label mix={lobbyStyle.field}>
                      <span>station name</span>
                      <input mix={desktopStyle.input} name="name" maxlength={48} required={true} />
                    </label>
                    <label mix={lobbyStyle.field}>
                      <span>address</span>
                      <input
                        mix={desktopStyle.input}
                        name="slug"
                        placeholder="late-night"
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        maxlength={40}
                        required={true}
                      />
                    </label>
                    <button mix={desktopStyle.primaryButton} type="submit">
                      create station
                    </button>
                  </form>
                </section>
              ) : null}

              {identity ? (
                <form method="post" action={routes.logout.href()}>
                  <button mix={desktopStyle.smallButton} type="submit">
                    sign out
                  </button>
                </form>
              ) : null}
            </div>
          </section>
        </main>
      </Document>
    );
  };
}

const lobbyStyle = {
  page: css({
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "clamp(12px, 4vw, 52px)",
    display: "grid",
    placeItems: "center",
    background: `radial-gradient(circle at 50% 12%, ${desktopColor.accentSoft}, transparent 28rem), #d6d6d6`,
  }),
  window: css({ width: "min(720px, 100%)" }),
  titleBar: css({ justifyContent: "space-between", gap: "16px" }),
  body: css({ display: "grid", gap: "20px", padding: "clamp(18px, 5vw, 42px)" }),
  eyebrow: css({
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  }),
  heading: css({
    margin: "4px 0 8px",
    fontSize: "clamp(32px, 7vw, 58px)",
    lineHeight: 0.95,
    letterSpacing: "-0.05em",
  }),
  intro: css({ maxWidth: "54ch", margin: 0, color: "#445159" }),
  message: css({
    margin: 0,
    padding: "10px",
    background: "#fff3cd",
    border: `1px solid ${desktopColor.line}`,
  }),
  form: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    "& > fieldset": { gridColumn: "1 / -1" },
    "& > button": { alignSelf: "end" },
    "@media (max-width: 560px)": { gridTemplateColumns: "1fr" },
  }),
  rooms: css({
    border: 0,
    padding: 0,
    margin: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "8px",
  }),
  legend: css({
    padding: "0 0 6px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  }),
  station: css({
    display: "flex",
    gap: "9px",
    padding: "11px",
    cursor: "pointer",
    background: desktopColor.paper,
    border: `1px solid ${desktopColor.line}`,
    "&:has(input:checked)": { background: desktopColor.accentSoft, borderColor: desktopColor.ink },
    "& span": { display: "grid" },
    "& small": { color: "#59666d" },
  }),
  field: css({
    display: "grid",
    gap: "4px",
    "& > span": { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" },
  }),
  createPanel: css({ padding: "16px", "& h2": { margin: 0 }, "& p": { margin: "4px 0 14px" } }),
  createForm: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    alignItems: "end",
    gap: "10px",
    "@media (max-width: 620px)": { gridTemplateColumns: "1fr" },
  }),
};
