package main

import "testing"

func TestInvalidCommand(t *testing.T) {
	for _, args := range [][]string{nil, {"invalid"}, {"up", "down"}} {
		if err := run(args); err == nil {
			t.Fatalf("esperava erro de uso para %v", args)
		}
	}
}
