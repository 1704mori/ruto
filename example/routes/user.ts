export function get(name: string, surname: string, age: number) {
  return {
    message: `Hello ${name} ${surname}! You are ${age} years old!`,
    timestamp: new Date(),
  }
}

export function post(body: { name: string }) {
  return {
    message: `Hello ${body.name}!`,
  };
}
