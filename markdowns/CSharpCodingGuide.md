# 📘 คู่มือมาตรฐานการเขียนโค้ด C# สำหรับ Unity (CaDaCook C# Coding Guide)

คู่มือนี้กำหนดมาตรฐานการเขียนโค้ดภาษา **C#** สำหรับโปรเจกต์เกม **CaDaCook** เพื่อให้โค้ดมีโครงสร้างสะอาด อ่านง่าย ยืดหยุ่น และมีประสิทธิภาพสูงสุดตามมาตรฐานของ Unity 6

---

## 🏷️ 1. กฎการตั้งชื่อ (Naming Conventions)

| หมวดหมู่องค์ประกอบ (Element) | รูปแบบการตั้งชื่อ (Convention) | ตัวอย่าง (Example) |
| :--- | :--- | :--- |
| **Class & Struct** | `PascalCase` | `KitchenGameManager`, `StoveCounter`, `RecipeSO` |
| **Interface** | `IPascalCase` (ขึ้นต้นด้วย `I`) | `IKitchenObjectParent`, `IHasProgress` |
| **Method / Function** | `PascalCase` | `GetMovementVectorNormalized()`, `Interact()` |
| **Public Property** | `PascalCase` | `Instance`, `State`, `IsWalking` |
| **C# Event & Delegate** | `On...` (`PascalCase`) | `OnStateChanged`, `OnProgressChanged`, `OnCut` |
| **Private / Protected Field** | `camelCase` (หรือ `_camelCase`) | `state`, `fryingTimer`, `waitingrecipeSOList` |
| **Serialized Field in Inspector** | `[SerializeField] private type camelCase` | `[SerializeField] private float moveSpeed;` |
| **Local Variable & Parameter** | `camelCase` | `inputVector`, `plateKitchenObject` |
| **Enum Type & Enum Value** | `PascalCase` | `State { WaitingToStart, CountdownToStart }` |
| **Constant (`const` / `readonly`)**| `PascalCase` หรือ `UPPER_CASE` | `MaxPlatesAmount`, `SPAWN_TIMER_MAX` |

---

## 🔄 2. ลำดับโครงสร้างภายในคลาส MonoBehaviour (Class Structure Order)

ควรจัดเรียงลำดับโค้ดในไฟล์ C# ให้เป็นระเบียบตามลำดับต่อไปนี้เสมอ:

```csharp
public class CuttingCounter : BaseCounter, IHasProgress
{
    // 1. Events
    public event EventHandler<IHasProgress.OnProgressChangedEventArgs> OnProgressChanged;
    public event EventHandler OnCut;

    // 2. Constants & Enums (ถ้ามี)
    
    // 3. Serialized Fields (ตั้งค่าใน Inspector)
    [SerializeField] private CuttingRecipeSO[] cuttingRecipeSOArray;

    // 4. Private Fields (ตัวแปรภายใน)
    private int cuttingProgress;

    // 5. Unity Lifecycle Methods (เรียงตามลำดับการทำงาน)
    private void Awake() { ... }
    private void Start() { ... }
    private void Update() { ... }
    private void OnDestroy() { ... }

    // 6. Public Methods / Interface Implementations
    public override void Interact(Player player) { ... }
    public override void InteractAlternate(Player player) { ... }

    // 7. Private Helper Methods
    private bool HasRecipeWithInput(KitchenObjectSO inputKitchenObjectSO) { ... }
}
```

---

## ⚡ 3. ประสิทธิภาพและการบริหารจัดการหน่วยความจำ (Performance & Memory)

1. **หลีกเลี่ยงการจัดสรรหน่วยความจำใน `Update()` (Zero GC Allocation):**
   - ❌ **ไม่ควรทำ:** `void Update() { List<int> list = new List<int>(); }`
   - ✅ **ควรทำ:** สร้างตัวแปรไว้ในระดับคลาส แล้วเรียก `.Clear()` เพื่อนำกลับมาใช้ซ้ำ
2. **Cache คอมโพเนนต์และอินสแตนซ์เสมอ:**
   - ❌ **ไม่ควรทำ:** `GetComponent<Rigidbody>()` หรือ `GameObject.Find()` ทุกเฟรมใน `Update()`
   - ✅ **ควรทำ:** ดึงค่าใส่ตัวแปรไว้ตั้งแต่ฟังก์ชัน `Awake()` หรือ `Start()`
3. **การใช้งาน String อย่างประหยัด:**
   - หลีกเลี่ยงการต่อสตริง (`"Time: " + timer`) ใน `Update()` โดยไม่จำเป็น ให้ใช้เมื่อค่ามีการเปลี่ยนแปลงจริงเท่านั้น

---

## 🛡️ 4. การจัดการ C# Events และความปลอดภัย (Events & Null Safety)

1. **Safe Event Invocation:**
   - ใช้เครื่องหมาย `?.` ก่อนสั่ง `.Invoke()` ทุกครั้ง:
     ```csharp
     OnRecipeSuccess?.Invoke(this, EventArgs.Empty);
     ```
2. **การ Unsubscribe เพื่อป้องกัน Memory Leak:**
   - เมื่อมีการ Subscribe Event ข้ามคลาสใน `Start()` ให้ Unsubscribe ใน `OnDestroy()` เสมอ:
     ```csharp
     private void Start()
     {
         KitchenGameManager.Instance.OnStateChanged += KitchenGameManager_OnStateChanged;
     }

     private void OnDestroy()
     {
         if (KitchenGameManager.Instance != null)
         {
             KitchenGameManager.Instance.OnStateChanged -= KitchenGameManager_OnStateChanged;
         }
     }
     ```

---

## 🎯 5. โครงสร้างตรรกะแบบ Flat (Guard Clauses & De Morgan's Laws)

ใช้ Guard Clauses เพื่อออกจากฟังก์ชันทันทีเมื่อเงื่อนไขไม่ถูกต้อง:

```csharp
// ❌ ไม่แนะนำ: Nesting ซ้อนกันลึก
public void Interact(Player player)
{
    if (KitchenGameManager.Instance.IsGamePlaying())
    {
        if (player.HasKitchenObject())
        {
            if (player.GetKitchenObject().TryGetPlate(out PlateKitchenObject plate))
            {
                // ตรรกะ...
            }
        }
    }
}

// ✅ แนะนำ: Early Return โครงสร้างแบนราบ อ่านง่าย
public void Interact(Player player)
{
    if (!KitchenGameManager.Instance.IsGamePlaying()) return;
    if (!player.HasKitchenObject()) return;

    if (player.GetKitchenObject().TryGetPlate(out PlateKitchenObject plate))
    {
        // ตรรกะ...
    }
}
```
