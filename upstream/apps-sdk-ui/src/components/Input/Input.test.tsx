import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Input } from "./"

describe("Input", () => {
  it("passes autoComplete to the native input", () => {
    const { getByPlaceholderText } = render(
      <Input autoComplete="email" placeholder="Email address" />,
    )

    expect(getByPlaceholderText("Email address")).toHaveAttribute("autocomplete", "email")
  })

  it("allows autofill extensions by default when autoComplete is provided", () => {
    const { getByPlaceholderText } = render(
      <Input autoComplete="email" placeholder="Email address" />,
    )

    const input = getByPlaceholderText("Email address")
    expect(input).not.toHaveAttribute("data-lpignore")
    expect(input).not.toHaveAttribute("data-1p-ignore")
  })

  it("allows autofill extensions to be explicitly disabled when autoComplete is provided", () => {
    const { getByPlaceholderText } = render(
      <Input allowAutofillExtensions={false} autoComplete="email" placeholder="Email address" />,
    )

    const input = getByPlaceholderText("Email address")
    expect(input).toHaveAttribute("autocomplete", "email")
    expect(input).toHaveAttribute("data-lpignore", "true")
    expect(input).toHaveAttribute("data-1p-ignore", "true")
  })
})
