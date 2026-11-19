"use client";

import { FormEvent, useState } from "react";
import { GROUP_SIZES, INVESTMENT_OPTIONS, PLANNING_OPTIONS } from "@/lib/choir-site/forms";

export function InquiryForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "draft">("idle");
  const [error, setError] = useState("");
  const [mailto, setMailto] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("sending");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/choir/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        phone: form.get("phone"),
        planning: form.get("planning"),
        groupSize: form.get("groupSize"),
        location: form.get("location"),
        date: form.get("date"),
        investment: form.getAll("investment"),
        about: form.get("about"),
        company_website: form.get("company_website"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("idle");
      setError(data.error || "Could not send the inquiry.");
      return;
    }
    if (data.delivered) {
      setState("done");
      return;
    }
    setMailto(typeof data.mailto === "string" ? data.mailto : "");
    setState("draft");
  }

  if (state === "done") {
    return (
      <section className="choir-section" style={{ maxWidth: 760 }}>
        <h1 className="choir-display">Inquiry sent</h1>
        <p>Thanks. We’ll read what you sent and write back about the gathering.</p>
      </section>
    );
  }

  return (
    <section className="choir-section" style={{ maxWidth: 760 }}>
      <p className="choir-eyebrow">Book</p>
      <h1 className="choir-display">Inquiry form</h1>
      <p>Tell us about the room. We’ll take it from there.</p>
      <form className="choir-form" onSubmit={onSubmit}>
        <label className="choir-honeypot">
          Company
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
        <div className="choir-form-row">
          <label className="choir-field">
            First name
            <input name="firstName" required autoComplete="given-name" />
          </label>
          <label className="choir-field">
            Last name
            <input name="lastName" required autoComplete="family-name" />
          </label>
        </div>
        <div className="choir-form-row">
          <label className="choir-field">
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label className="choir-field">
            Phone
            <input name="phone" type="tel" autoComplete="tel" />
          </label>
        </div>
        <label className="choir-field">
          What are you planning?
          <select name="planning" defaultValue="">
            <option value="">Select an option</option>
            {PLANNING_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="choir-field">
          Group size
          <select name="groupSize" defaultValue="">
            <option value="">Select an option</option>
            {GROUP_SIZES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="choir-form-row">
          <label className="choir-field">
            Event location
            <input name="location" placeholder="City and venue if known" />
          </label>
          <label className="choir-field">
            Date of event
            <input name="date" type="date" />
          </label>
        </div>
        <fieldset className="choir-field" style={{ border: 0, padding: 0 }}>
          <legend>Investment level you’re considering</legend>
          <div className="choir-checks">
            {INVESTMENT_OPTIONS.map((option) => (
              <label key={option}>
                <input type="checkbox" name="investment" value={option} />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="choir-field">
          Can you tell us a bit about the event?
          <textarea
            name="about"
            rows={6}
            placeholder="E.g. We'd like you to create an anthem and facilitate our closing ceremony for about 2,500 people at our annual conference in Las Vegas."
          />
        </label>
        {error ? <p>{error}</p> : null}
        {state === "draft" ? (
          <p>
            Mail isn’t connected on this server yet. <a href={mailto}>Send the inquiry by email</a> and it will reach us.
          </p>
        ) : null}
        <button className="choir-btn" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send inquiry"}
        </button>
      </form>
    </section>
  );
}
