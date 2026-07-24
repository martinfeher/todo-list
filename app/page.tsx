import { TodoApp } from "./components/todo-app";
import { getTodoData } from "@/lib/todo-data";

export default async function Home() {
  const { lists, labelTags, tasksByList } = await getTodoData();

  return (
    <TodoApp
      initialLists={lists}
      initialLabelTags={labelTags}
      initialTasksByList={tasksByList}
    />
  );
}
