export class MeridianForm extends HTMLElement {
  static get observedAttributes() {
    return ["form-id", "api-base", "theme", "locale", "mode", "auth-token", "submission-id"];
  }

  constructor() {
    super();
    this._values = {};
    this._form = null;
  }

  connectedCallback() {
    this.lang = this.getAttribute("locale") || "en";
    void this.load();
  }

  attributeChangedCallback() {
    if (this.isConnected) void this.load();
  }

  headers() {
    const headers = { accept: "application/json" };
    const token = this.getAttribute("auth-token");
    if (token) headers.authorization = `Bearer ${token}`;
    return headers;
  }

  async load() {
    const base = this.getAttribute("api-base") || "";
    const id = this.getAttribute("form-id");
    if (!id) return;
    try {
      const response = await fetch(`${base}/api/agent/v1/forms/${encodeURIComponent(id)}`, { headers: this.headers() });
      if (!response.ok) throw new Error(`Form request failed (${response.status})`);
      this._form = await response.json();
      this.renderForm();
      this.dispatchEvent(new CustomEvent("meridian-ready", { detail: { formId: id } }));
    } catch (error) {
      this.textContent = error instanceof Error ? error.message : "Form failed to load";
      this.dispatchEvent(new CustomEvent("meridian-error", { detail: { message: this.textContent } }));
    }
  }

  renderForm() {
    const root = document.createElement("form");
    root.setAttribute("aria-label", this._form?.title || "Form");
    for (const component of this._form?.components || []) {
      if (!["textfield", "email", "number", "textarea", "select", "checkbox"].includes(component.type)) continue;
      const label = document.createElement("label");
      label.textContent = component.label || component.key;
      const input = component.type === "textarea" ? document.createElement("textarea") : component.type === "select" ? document.createElement("select") : document.createElement("input");
      if (input instanceof HTMLInputElement) input.type = component.type === "checkbox" ? "checkbox" : component.type === "number" ? "number" : component.type === "email" ? "email" : "text";
      input.name = component.key;
      input.required = Boolean(component.required);
      input.addEventListener("input", () => {
        this._values[component.key] = input.type === "checkbox" ? input.checked : input.value;
        this.dispatchEvent(new CustomEvent("meridian-change", { detail: { values: { ...this._values } } }));
      });
      label.append(input);
      root.append(label);
    }
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Submit";
    root.append(button);
    root.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submit();
    });
    this.replaceChildren(root);
  }

  async submit() {
    const base = this.getAttribute("api-base") || "";
    const id = this.getAttribute("form-id");
    this.dispatchEvent(new CustomEvent("meridian-submit", { detail: { values: { ...this._values } } }));
    const response = await fetch(`${base}/api/agent/v1/forms/${encodeURIComponent(id)}/submissions`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({ data: this._values, submissionId: this.getAttribute("submission-id") }),
    });
    if (!response.ok) {
      this.dispatchEvent(new CustomEvent("meridian-error", { detail: { message: `Submit failed (${response.status})` } }));
    }
    return response;
  }
}

if (typeof customElements !== "undefined") customElements.define("meridian-form", MeridianForm);
