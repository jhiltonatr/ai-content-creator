import { Route, Routes } from 'react-router-dom'
import './index.css'
import StoryBookPage from './pages/StoryBookPage'
import StoryContentPage from './pages/StoryContentPage'
import StoryCreatePage from './pages/StoryCreatePage'
import StoryEditPage from './pages/StoryEditPage'
import StoriesListPage from './pages/StoriesListPage'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Content Creator</h1>
        <p>Editor workspace for novels, RPG-style stories and more</p>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<StoriesListPage />} />
          <Route path="/stories/new" element={<StoryCreatePage />} />
          <Route path="/stories/:storyId/edit" element={<StoryEditPage />} />
          <Route path="/stories/:storyId/content" element={<StoryContentPage />} />
          <Route path="/stories/:storyId/books/:bookId" element={<StoryBookPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App