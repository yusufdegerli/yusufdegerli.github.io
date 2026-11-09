#pragma once

#include <condition_variable>
#include <functional>
#include <future>
#include <mutex>
#include <queue>
#include <stdexcept>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

namespace mc2 {

// Minimal fixed-size thread pool for terrain gen + mesh builds (arm64 / macOS).
class ThreadPool {
public:
    explicit ThreadPool(std::size_t workerCount)
    {
        if (workerCount == 0) {
            workerCount = 1;
        }
        m_workers.reserve(workerCount);
        for (std::size_t i = 0; i < workerCount; ++i) {
            m_workers.emplace_back([this] { workerLoop(); });
        }
    }

    ~ThreadPool()
    {
        {
            std::lock_guard<std::mutex> lock(m_mutex);
            m_stopping = true;
        }
        m_cv.notify_all();
        for (std::thread& t : m_workers) {
            if (t.joinable()) {
                t.join();
            }
        }
    }

    ThreadPool(const ThreadPool&) = delete;
    ThreadPool& operator=(const ThreadPool&) = delete;

    template <typename F, typename... Args>
    auto submit(F&& f, Args&&... args)
        -> std::future<typename std::invoke_result<F, Args...>::type>
    {
        using R = typename std::invoke_result<F, Args...>::type;

        auto task = std::make_shared<std::packaged_task<R()>>(
            std::bind(std::forward<F>(f), std::forward<Args>(args)...));

        std::future<R> future = task->get_future();
        {
            std::lock_guard<std::mutex> lock(m_mutex);
            if (m_stopping) {
                throw std::runtime_error("ThreadPool is stopping");
            }
            m_jobs.emplace([task]() { (*task)(); });
        }
        m_cv.notify_one();
        return future;
    }

    std::size_t workerCount() const { return m_workers.size(); }

private:
    void workerLoop()
    {
        for (;;) {
            std::function<void()> job;
            {
                std::unique_lock<std::mutex> lock(m_mutex);
                m_cv.wait(lock, [this] { return m_stopping || !m_jobs.empty(); });
                if (m_stopping && m_jobs.empty()) {
                    return;
                }
                job = std::move(m_jobs.front());
                m_jobs.pop();
            }
            job();
        }
    }

    std::vector<std::thread> m_workers;
    std::queue<std::function<void()>> m_jobs;
    std::mutex m_mutex;
    std::condition_variable m_cv;
    bool m_stopping = false;
};

} // namespace mc2
