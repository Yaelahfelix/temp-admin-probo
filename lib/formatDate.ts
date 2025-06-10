import { format } from "date-fns";
import { id } from "date-fns/locale";

export const formatDate = (date: Date) => {
  return format(date, "d MMMM yyyy", { locale: id });
};
