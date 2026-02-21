"use client";

import { useState, useEffect } from "react";

interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  instructions: string | null;
  tags: string | null;
  ingredients: Ingredient[];
  createdAt: string;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  const [newRecipe, setNewRecipe] = useState({
    title: "",
    description: "",
    servings: 4,
    prepTime: "",
    cookTime: "",
    ingredients: "",
    instructions: "",
    tags: "",
  });

  useEffect(() => {
    fetchRecipes();
  }, []);

  async function fetchRecipes() {
    const res = await fetch("/api/recipes");
    const data = await res.json();
    setRecipes(data);
    setLoading(false);
  }

  async function handleImportUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!importUrl) return;

    setImporting(true);
    setImportResult(null);

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: importUrl }),
    });

    const data = await res.json();
    setImporting(false);

    if (res.ok) {
      setImportResult(`Imported: ${data.title}`);
      setImportUrl("");
      fetchRecipes();
    } else {
      setImportResult(`Error: ${data.error}`);
    }
  }

  async function handleAddRecipe(e: React.FormEvent) {
    e.preventDefault();

    const ingredients = newRecipe.ingredients
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.trim().match(/^([\d.]+)\s*(\w+)\s+(.+)$/);
        if (parts) {
          return { quantity: parseFloat(parts[1]), unit: parts[2], name: parts[3] };
        }
        return { quantity: 1, unit: "item", name: line.trim() };
      });

    const instructions = newRecipe.instructions
      .split("\n")
      .filter(Boolean)
      .map((line) => line.trim());

    await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newRecipe.title,
        description: newRecipe.description,
        servings: newRecipe.servings,
        prepTime: newRecipe.prepTime ? parseInt(newRecipe.prepTime) : null,
        cookTime: newRecipe.cookTime ? parseInt(newRecipe.cookTime) : null,
        ingredients,
        instructions,
        tags: newRecipe.tags,
      }),
    });

    setNewRecipe({ title: "", description: "", servings: 4, prepTime: "", cookTime: "", ingredients: "", instructions: "", tags: "" });
    setShowAddForm(false);
    fetchRecipes();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this recipe?")) return;
    await fetch(`/api/recipes?id=${id}`, { method: "DELETE" });
    fetchRecipes();
  }

  function parseInstructions(raw: string | null): string[] {
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [raw];
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Recipes</h1>
          <p className="text-gray-500 mt-1">
            Import recipes from URLs or add them manually. AI extracts ingredients automatically.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
        >
          + Add Recipe
        </button>
      </div>

      {/* URL Import */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Import Recipe from URL</h2>
        <p className="text-sm text-gray-500 mb-4">
          Paste a recipe link and AI will extract the title, ingredients, and instructions.
        </p>
        <form onSubmit={handleImportUrl} className="flex gap-3">
          <input
            type="url"
            required
            placeholder="https://www.example.com/recipe/..."
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            className="border rounded-lg px-4 py-2 text-sm flex-1"
          />
          <button
            type="submit"
            disabled={importing}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
          >
            {importing ? "Extracting..." : "Import"}
          </button>
        </form>
        {importing && (
          <div className="mt-4 flex items-center gap-2 text-purple-600">
            <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full" />
            <span className="text-sm">AI is extracting the recipe...</span>
          </div>
        )}
        {importResult && (
          <div className={`mt-4 px-4 py-2 rounded-lg text-sm ${importResult.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {importResult}
          </div>
        )}
      </div>

      {/* Manual Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add Recipe Manually</h2>
          <form onSubmit={handleAddRecipe} className="space-y-4">
            <input
              required
              placeholder="Recipe title"
              value={newRecipe.title}
              onChange={(e) => setNewRecipe({ ...newRecipe, title: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
            <input
              placeholder="Description"
              value={newRecipe.description}
              onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                min="1"
                placeholder="Servings"
                value={newRecipe.servings}
                onChange={(e) => setNewRecipe({ ...newRecipe, servings: parseInt(e.target.value) })}
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                placeholder="Prep time (min)"
                value={newRecipe.prepTime}
                onChange={(e) => setNewRecipe({ ...newRecipe, prepTime: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                placeholder="Cook time (min)"
                value={newRecipe.cookTime}
                onChange={(e) => setNewRecipe({ ...newRecipe, cookTime: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Ingredients (one per line: &quot;2 cups flour&quot; or just &quot;flour&quot;)
              </label>
              <textarea
                rows={5}
                placeholder={"2 lb chicken breast\n1 tbsp olive oil\n3 cloves garlic"}
                value={newRecipe.ingredients}
                onChange={(e) => setNewRecipe({ ...newRecipe, ingredients: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm w-full font-mono"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Instructions (one step per line)</label>
              <textarea
                rows={5}
                placeholder={"Preheat oven to 375F\nSeason chicken with salt and pepper\nBake for 25 minutes"}
                value={newRecipe.instructions}
                onChange={(e) => setNewRecipe({ ...newRecipe, instructions: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm w-full font-mono"
              />
            </div>
            <input
              placeholder="Tags (comma-separated: dinner, easy, healthy)"
              value={newRecipe.tags}
              onChange={(e) => setNewRecipe({ ...newRecipe, tags: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm w-full"
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
                Save Recipe
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recipes List */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading...</div>
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📖</p>
          <p>No recipes yet. Import from a URL or add one manually.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{recipe.title}</h3>
                    {recipe.description && (
                      <p className="text-sm text-gray-500 mt-1">{recipe.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(recipe.id)}
                    className="text-gray-400 hover:text-red-500 text-sm"
                  >
                    &times;
                  </button>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span>{recipe.servings} servings</span>
                  {recipe.prepTime && <span>Prep: {recipe.prepTime}m</span>}
                  {recipe.cookTime && <span>Cook: {recipe.cookTime}m</span>}
                </div>
                {recipe.tags && (
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {recipe.tags.split(",").map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
                {recipe.sourceUrl && (
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-2 inline-block"
                  >
                    View original recipe
                  </a>
                )}
                <button
                  onClick={() => setExpandedRecipe(expandedRecipe === recipe.id ? null : recipe.id)}
                  className="text-xs text-emerald-600 hover:text-emerald-800 mt-2 block"
                >
                  {expandedRecipe === recipe.id ? "Hide details" : "Show details"}
                </button>
              </div>

              {expandedRecipe === recipe.id && (
                <div className="border-t bg-gray-50 p-5">
                  {recipe.ingredients.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-sm mb-2">Ingredients</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {recipe.ingredients.map((ing) => (
                          <li key={ing.id}>
                            {ing.quantity} {ing.unit} {ing.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recipe.instructions && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Instructions</h4>
                      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                        {parseInstructions(recipe.instructions).map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
