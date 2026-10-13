import React, { useEffect, useState } from 'react';
import { supabase } from './src/lib/supabase';

interface Todo {
  id: string | number;
  name?: string;
  title?: string;
}

export default function Page() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTodos() {
      try {
        const { data, error } = await supabase.from('todos').select();
        if (error) {
          console.error('Erro ao consultar todos:', error);
        } else if (data) {
          setTodos(data as Todo[]);
        }
      } catch (err) {
        console.error('Exceção ao consultar Supabase:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTodos();
  }, []);

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>{todo.name || todo.title || String(todo.id)}</li>
      ))}
    </ul>
  );
}
