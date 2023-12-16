export function get(name: string, surname: string, age: number) {
  const v = "123";
  return {
    message: `Hello ${name} ${surname}! You are ${age} years old!`,
    timestamp: new Date(),
    value1: v,
    value2: name,
    value: {
      alo: true,
    },
  };
}

export function post(body: { name: string }) {
  return {
    message: `Hello ${body.name}!`,
  };
}
