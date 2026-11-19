#pragma once
#include <cstdint>

namespace live_https {
// Single-owner cache. Transport supplies begin(), poll() (-1/0/1), healthy(),
// close(), and release(). No HTTP request is made by this state machine.
template <class Transport> class Preconnect {
public:
  enum class State { Empty, Connecting, Ready };
  // Idle peers can close around 15 seconds after TLS completes. Retire before
  // that boundary: a healthy socket can otherwise close between the final
  // probe and POST, after which retrying could create a duplicate session.
  static constexpr int64_t TIMEOUT_MS = 30000, MAX_AGE_MS = 10000,
                           RETRY_MS = 5000;
  Transport transport;
  State state = State::Empty;
  int64_t started_at = 0, ready_at = 0;

  void clear() {
    transport.close();
    state = State::Empty;
  }
  void validate(int64_t now, uint32_t network, bool enabled) {
    if (network != network_) {
      clear();
      network_ = network;
      retry_at_ = 0;
    }
    if (!enabled || !(network & 1u)) {
      clear();
      retry_at_ = 0;
    } else if (state == State::Ready &&
               (now - ready_at >= MAX_AGE_MS || !transport.healthy())) {
      clear();
    }
  }
  void advance(int64_t now) {
    if (state != State::Connecting)
      return;
    const int progress = now - started_at >= TIMEOUT_MS ? -1 : transport.poll();
    if (progress < 0) {
      clear();
      retry_at_ = now + RETRY_MS;
    } else if (progress > 0) {
      state = State::Ready;
      ready_at = now;
    }
  }
  void idle(int64_t now, uint32_t network, bool enabled) {
    validate(now, network, enabled);
    if (!enabled || !(network & 1u))
      return;
    if (state == State::Empty && now >= retry_at_) {
      started_at = now;
      if (!transport.begin()) {
        retry_at_ = now + RETRY_MS;
        return;
      }
      state = State::Connecting;
    }
    advance(now);
  }
  // Only a ready connection can be transferred to an HTTP request. The caller
  // validates its network generation and health immediately before taking it.
  auto take() -> decltype(transport.release()) {
    if (state != State::Ready)
      return {};
    state = State::Empty;
    return transport.release();
  }

private:
  uint32_t network_ = 0;
  int64_t retry_at_ = 0;
};
} // namespace live_https
