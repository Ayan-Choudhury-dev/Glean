/// <reference path="../pb_data/types.d.ts" />

/**
 * Claiming an account.
 *
 * The web page creates a user with a random password and a short invite code,
 * then shows the code (and a link) instead of a password. The person opens the
 * link, chooses their own password, and the code is burned.
 *
 *   POST /api/glean/claim   { code, password }
 *
 * No auth on this route on purpose: the code is the credential, it expires in
 * 24 hours, and it stops existing the moment the account is claimed.
 */

routerAdd("POST", "/api/glean/claim", (c) => {
  try {
    // This build exposes `c.bindBody`, not the `c.bind` the docs describe.
    const body = new DynamicModel({ code: "", password: "" });
    c.bindBody(body);
    const code = String(body.code || "").trim().toUpperCase();
    const password = String(body.password || "");

    if (!code) {
      return c.json(400, { message: "Enter the invite code." });
    }
    if (password.length < 8) {
      return c.json(400, { message: "Use at least 8 characters." });
    }

    let user;
    try {
      // Positional params: the JSVM binds {:code} from the argument, not a map.
      // Params are a map here, not a positional value.
      user = $app.findFirstRecordByFilter("users", "invite_code = {:code}", { code: code });
    } catch (notFound) {
      console.error("claim lookup failed:", notFound);
      return c.json(400, { message: "That code is not valid any more." });
    }

    const expires = user.get("invite_expires");
    if (expires) {
      const at = new Date(String(expires)).getTime();
      if (!Number.isNaN(at) && at < Date.now()) {
        return c.json(400, { message: "That code has expired. Ask for a new one." });
      }
    }

    user.set("password", password);
    user.set("passwordConfirm", password);
    user.set("invite_code", "");
    user.set("invite_expires", null);
    $app.save(user);

    return c.json(200, { email: user.get("email") });
  } catch (error) {
    // Without this the caller only ever sees "something went wrong".
    console.error("glean claim failed:", error);
    return c.json(500, { message: "Could not set that password. Try again." });
  }
});
