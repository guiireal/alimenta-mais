package security

import "testing"

func TestPasswords(t *testing.T) {
	p := Passwords{}
	a, err := p.Hash("Secret1234")
	if err != nil {
		t.Fatal(err)
	}
	b, err := p.Hash("Secret1234")
	if err != nil {
		t.Fatal(err)
	}
	if a == b || a == "Secret1234" || !p.Compare(a, "Secret1234") || p.Compare(a, "wrong") {
		t.Fatal("hash, sal ou comparação incorreta")
	}
}
