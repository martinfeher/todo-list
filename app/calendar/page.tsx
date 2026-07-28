import { TodoApp } from "../components/todo-app";
import { getTodoData } from "@/lib/todo-data";

export default async function CalendarPage() {
  const { lists, labels, tasksByList } = await getTodoData();

  return (
    <TodoApp
      initialLists={lists}
      initialLabels={labels}
      initialTasksByList={tasksByList}
      initialActiveView="calendar"
    />
  );
}
