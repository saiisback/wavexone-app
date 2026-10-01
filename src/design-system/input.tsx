import { TextInput, type TextInputProps } from 'react-native'

/** Unlabelled input primitive for compact search fields. Forms should use `Field`. */
export function Input(props: TextInputProps) {
  return <TextInput {...props} />
}
