import { useNavigate } from "@tanstack/react-router";
import { CreateDialog } from "@/components/home/dashboard";
import { useFormStore } from "@/lib/forms/store";

export function CreateHost() {
  const open = useFormStore((s) => s.createOpen);
  const setOpen = useFormStore((s) => s.setCreateOpen);
  const addForm = useFormStore((s) => s.addForm);
  const navigate = useNavigate();
  return (
    <CreateDialog
      open={open}
      onOpenChange={setOpen}
      onCreate={(form) => {
        addForm(form);
        setOpen(false);
        void navigate({ to: "/studio/$formId", params: { formId: form.id } });
      }}
    />
  );
}
