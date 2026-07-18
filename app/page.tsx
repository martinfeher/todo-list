import { TodoApp } from "./components/todo-app";
import { getTodoData } from "@/lib/todo-data";

export default async function Home() {
  const { lists, tasksByList } = await getTodoData();

  return (
    <TodoApp initialLists={lists} initialTasksByList={tasksByList} />
  );
}
