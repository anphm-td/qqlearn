/** Nối className, bỏ giá trị rỗng — helper nhỏ dùng chung cho components. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
