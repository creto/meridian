import { MeridianFormRenderer, MeridianWorkflowInbox } from "../../packages/angular/src/view.ts";

const renderer = new MeridianFormRenderer({
  id: "supplier-registration",
  title: "Supplier registration",
  components: [
    { type: "textfield", key: "legalName", label: "Legal name", required: true },
    { type: "email", key: "email", label: "Email", required: true },
    { type: "panel", key: "more", label: "More", components: [{ type: "phone", key: "phone", label: "Phone" }] },
  ],
});

const model = renderer.render({ legalName: "Northwind", email: "ada@northwind.example" });
const inbox = new MeridianWorkflowInbox().render([{ id: "task_1", title: "Legal", status: "open" }]);
console.log(JSON.stringify({ fields: model.fields.length, errors: model.fields.filter((field) => field.error).length, inbox: inbox.length }));
