console.log('Artistry To-Do app is running');

// ── Supabase setup ──
// IMPORTANT: Replace YOUR_ANON_KEY_HERE with your Supabase anon/public key
// Find it at: Supabase Dashboard → Settings → API → Project API keys
var SUPABASE_URL = 'https://sopuxhemeqqhibrqvvba.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcHV4aGVtZXFxaGlicnF2dmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDE4MzcsImV4cCI6MjA5MDExNzgzN30.GGzrWWT6Q8_xyocbiZizvTxw-ZpFsBQy7luZviRN9Mw';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── App state ──
var currentUser = null;
var tasks = [];
var activeTab = 'walks';
var isLoading = true;

// ── Category config ──
var categories = {
  walks: { label: 'Walk Cycles', placeholder: 'Add a walk...' },
  groceries: { label: 'Grocery Runs', placeholder: 'Add a grocery item...' },
  workouts: { label: 'Workouts', placeholder: 'Add a workout...' }
};

// ── Auth ──
function signInWithGoogle() {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });
}

function signOut() {
  supabase.auth.signOut().then(function() {
    currentUser = null;
    tasks = [];
    renderApp();
  });
}

// ── Database operations ──
function fetchTasks() {
  isLoading = true;
  renderApp();
  supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true })
    .then(function(result) {
      if (result.error) {
        console.error('Error fetching tasks:', result.error);
        tasks = [];
      } else {
        tasks = result.data || [];
      }
      isLoading = false;
      renderApp();
    });
}

function addTask(e) {
  e.preventDefault();
  var input = document.getElementById('taskInput');
  var text = input.value.trim();
  if (!text || !currentUser) return;

  input.value = '';
  supabase
    .from('tasks')
    .insert({ text: text, category: activeTab, user_id: currentUser.id })
    .select()
    .then(function(result) {
      if (result.error) {
        console.error('Error adding task:', result.error);
      } else if (result.data) {
        tasks = tasks.concat(result.data);
        renderApp();
      }
    });
}

function toggleTask(taskId, currentDone) {
  supabase
    .from('tasks')
    .update({ done: !currentDone })
    .eq('id', taskId)
    .then(function(result) {
      if (!result.error) {
        tasks = tasks.map(function(t) {
          if (t.id === taskId) return Object.assign({}, t, { done: !currentDone });
          return t;
        });
        renderApp();
      }
    });
}

function deleteTask(taskId) {
  supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .then(function(result) {
      if (!result.error) {
        tasks = tasks.filter(function(t) { return t.id !== taskId; });
        renderApp();
      }
    });
}

// ── Render ──
function renderApp() {
  var container = document.getElementById('app');
  var root = container._root || (container._root = ReactDOM.createRoot(container));

  // Loading auth state
  if (isLoading && !currentUser) {
    root.render(
      <div className="container">
        <div className="loading">loading...</div>
      </div>
    );
    return;
  }

  // Not logged in — show login screen
  if (!currentUser) {
    root.render(
      <div className="container auth-container">
        <h1>Artistry To-Do</h1>
        <p className="auth-subtitle">walk cycles / grocery runs / workouts</p>
        <button className="google-btn" onClick={signInWithGoogle}>
          sign in with google
        </button>
      </div>
    );
    return;
  }

  // Logged in — show the app
  var filteredTasks = tasks.filter(function(t) { return t.category === activeTab; });
  var totalTasks = filteredTasks.length;
  var doneTasks = filteredTasks.filter(function(t) { return t.done; }).length;
  var pendingTasks = totalTasks - doneTasks;

  var taskList = filteredTasks.map(function(task) {
    return (
      <div key={task.id} className={task.done ? 'task done' : 'task'}>
        <div className="task-left">
          <input
            type="checkbox"
            checked={task.done}
            onChange={function() { toggleTask(task.id, task.done); }}
          />
          <span>{task.text}</span>
        </div>
        <button className="delete-btn" onClick={function() { deleteTask(task.id); }}>
          delete
        </button>
      </div>
    );
  });

  var content = filteredTasks.length > 0
    ? taskList
    : <p style={{ textAlign: 'center', opacity: 0.5 }}>
        no {categories[activeTab].label.toLowerCase()} yet
      </p>;

  var summary = totalTasks > 0
    ? <p className="summary">{pendingTasks} pending, {doneTasks} done — {totalTasks} total</p>
    : null;

  var displayName = currentUser.user_metadata
    ? (currentUser.user_metadata.full_name || currentUser.email)
    : currentUser.email;

  var tabButtons = Object.keys(categories).map(function(key) {
    return (
      <button
        key={key}
        className={activeTab === key ? 'tab active' : 'tab'}
        onClick={function() { activeTab = key; renderApp(); }}
      >
        {categories[key].label}
      </button>
    );
  });

  root.render(
    <div className="container">
      <h1>Artistry To-Do</h1>
      <div className="user-bar">
        <span>{displayName}</span>
        <button className="signout-btn" onClick={signOut}>sign out</button>
      </div>
      <div className="tabs">
        {tabButtons}
      </div>
      <form className="add-form" onSubmit={addTask}>
        <input type="text" id="taskInput" placeholder={categories[activeTab].placeholder} />
        <button type="submit">+ add</button>
      </form>
      {isLoading ? <div className="loading">loading...</div> : content}
      {summary}
    </div>
  );
}

// ── Init: check auth state ──
supabase.auth.getSession().then(function(result) {
  if (result.data.session) {
    currentUser = result.data.session.user;
    fetchTasks();
  } else {
    isLoading = false;
    renderApp();
  }
});

// Listen for auth changes (handles OAuth redirect)
supabase.auth.onAuthStateChange(function(event, session) {
  if (session) {
    currentUser = session.user;
    fetchTasks();
  } else {
    currentUser = null;
    tasks = [];
    isLoading = false;
    renderApp();
  }
});
