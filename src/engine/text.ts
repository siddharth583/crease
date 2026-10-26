/** "1 ball", "2 balls"; pass the plural for irregular words ("1 match", "3 matches"). */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
